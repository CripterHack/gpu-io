// Main is called from ../common/wrapper.js
function main({ pane, contextID, glslVersion }) {
  const {
    GPUComposer,
    GPUProgram,
    GPULayer,
    INT,
    FLOAT,
    LINEAR,
    NEAREST,
    setValueProgram,
  } = GPUIO;

  // Register Tweakpane Essentials if available (for segmented controls)
  if (typeof TweakpaneEssentialsPlugin !== 'undefined' && TweakpaneEssentialsPlugin) {
    pane.registerPlugin(TweakpaneEssentialsPlugin);
  }

  const PARAMS = {
    seedCount: 256,
    seedRadiusMin: 2,
    seedRadiusMax: 8,
    showVoronoi: true,
    showBorders: true,
    borderAlpha: 0.35,
    showSDF: false,
    signed: false,
    showIsolines: false,
    isoFreq: 0.05,
    refineAfterJfa: true,
  };

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '0';
  document.body.appendChild(canvas);

  const composer = new GPUComposer({ canvas, contextID, glslVersion });
  composer.resize([window.innerWidth, window.innerHeight]);

  // Seed helpers
  function makeSeeds(count) {
    const w = canvas.width, h = canvas.height;
    const pos = new Float32Array(count * 2);
    const attrs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = PARAMS.seedRadiusMin + Math.random() * (PARAMS.seedRadiusMax - PARAMS.seedRadiusMin);
      pos[2 * i] = x;
      pos[2 * i + 1] = y;
      attrs[3 * i] = x;
      attrs[3 * i + 1] = y;
      attrs[3 * i + 2] = r;
    }
    return { pos, attrs };
  }

  let { pos, attrs } = makeSeeds(PARAMS.seedCount);

  const seedPositions = new GPULayer(composer, {
    name: 'jfa_seed_positions',
    dimensions: PARAMS.seedCount,
    numComponents: 2,
    type: FLOAT,
    numBuffers: 1,
    array: pos,
    filter: NEAREST,
  });

  const seedAttrs = new GPULayer(composer, {
    name: 'jfa_seed_attrs',
    dimensions: PARAMS.seedCount,
    numComponents: 3,
    type: FLOAT,
    numBuffers: 1,
    array: attrs,
    filter: NEAREST,
  });

  const nearest = new GPULayer(composer, {
    name: 'jfa_nearest',
    dimensions: [canvas.width, canvas.height],
    numComponents: 4,
    type: FLOAT,
    filter: NEAREST,
    numBuffers: 2,
  });

  const dist = new GPULayer(composer, {
    name: 'jfa_dist',
    dimensions: [canvas.width, canvas.height],
    numComponents: 1,
    type: FLOAT,
    filter: LINEAR,
    numBuffers: 1,
  });

  // Shaders (inlined para compatibilidad con wrapper síncrono)
  const jfaSeedSrc = `
// Seed initialization for JFA using drawLayerAsPoints()
// Writes candidate = [seedUV.x, seedUV.y, normalizedId, 0]
// Available varyings: v_index, v_uv_position, v_position
in vec2 v_uv;
flat in int v_index;
uniform float u_seedCount;
out vec4 out_nearest;

void main() {
    // Normalize ID to [0,1]; guard for 1 seed
    float denom = max(1.0, u_seedCount - 1.0);
    float idNorm = float(v_index) / denom;
    // Write seed UV as current fragment UV
    out_nearest = vec4(v_uv, idNorm, 0.0);
}
`;
  const jfaPassSrc = `
// One JFA pass with jump distance u_jump
in vec2 v_uv;
uniform sampler2D u_nearest;
uniform vec2 u_px;        // 1/texSize
uniform vec2 u_texSize;    // tex width, height
uniform float u_jump;       // jump in pixels
uniform float u_emptyId;    // empty marker (< 0)
out vec4 out_nearest;

float candidateDistPx(vec4 candidate, vec2 uv) {
    // Candidate.z holds normalized id; candidate.xy stores seed UV
    if (candidate.z < 0.0) return 1e9;
    vec2 d = (uv - candidate.xy);
    // Convert UV delta to pixels using tex size
    vec2 dPx = vec2(d.x * u_texSize.x, d.y * u_texSize.y);
    return length(dPx);
}

void main() {
    vec4 best = texture(u_nearest, v_uv);
    float bestDist = candidateDistPx(best, v_uv);

    // 8 neighbors with +/- jump (axis-aligned and diagonals)
    vec2 j = u_px * u_jump;
    vec2 offsets[8];
    offsets[0] = vec2( j.x,  0.0);
    offsets[1] = vec2(-j.x,  0.0);
    offsets[2] = vec2( 0.0,  j.y);
    offsets[3] = vec2( 0.0, -j.y);
    offsets[4] = vec2( j.x,  j.y);
    offsets[5] = vec2( j.x, -j.y);
    offsets[6] = vec2(-j.x,  j.y);
    offsets[7] = vec2(-j.x, -j.y);

    for (int i = 0; i < 8; i++) {
        vec4 cand = texture(u_nearest, v_uv + offsets[i]);
        float d = candidateDistPx(cand, v_uv);
        if (d < bestDist) {
            bestDist = d;
            best = cand;
        }
    }

    // Preserve empty state if no candidate (optional safeguard)
    if (best.z < 0.0) {
        best = vec4(0.0, 0.0, u_emptyId, 0.0);
    }

    out_nearest = best;
}
`;
  const jfaRefineSrc = `
// JFA refine pass (JFA+): fixed jump = 1 pixel
in vec2 v_uv;
uniform sampler2D u_nearest;
uniform vec2 u_px;
uniform vec2 u_texSize;
uniform float u_emptyId;
out vec4 out_nearest;

float candidateDistPx(vec4 candidate, vec2 uv) {
    if (candidate.z < 0.0) return 1e9;
    vec2 d = (uv - candidate.xy);
    vec2 dPx = vec2(d.x * u_texSize.x, d.y * u_texSize.y);
    return length(dPx);
}

void main() {
    vec4 best = texture(u_nearest, v_uv);
    float bestDist = candidateDistPx(best, v_uv);

    vec2 j = u_px * 1.0;
    vec2 offsets[8];
    offsets[0] = vec2( j.x,  0.0);
    offsets[1] = vec2(-j.x,  0.0);
    offsets[2] = vec2( 0.0,  j.y);
    offsets[3] = vec2( 0.0, -j.y);
    offsets[4] = vec2( j.x,  j.y);
    offsets[5] = vec2( j.x, -j.y);
    offsets[6] = vec2(-j.x,  j.y);
    offsets[7] = vec2(-j.x, -j.y);

    for (int i = 0; i < 8; i++) {
        vec4 cand = texture(u_nearest, v_uv + offsets[i]);
        float d = candidateDistPx(cand, v_uv);
        if (d < bestDist) {
            bestDist = d;
            best = cand;
        }
    }

    if (best.z < 0.0) {
        best = vec4(0.0, 0.0, u_emptyId, 0.0);
    }

    out_nearest = best;
}
`;
  const sdfSrc = `
// Compute Distance Field (DF) or Signed Distance Field (SDF) from nearest candidate
in vec2 v_uv;
uniform sampler2D u_nearest;
uniform vec2 u_texSize;      // width, height of nearest
uniform bool u_signed;        // true -> subtract seed radius
uniform sampler2D u_seeds;    // packed 2D texture of seeds [x,y,r]
uniform float u_seedCount;    // number of seeds
uniform vec2 u_seedTexDims;   // seeds texture width, height
out float out_dist;

float sampleSeedRadius(float idNorm) {
    if (idNorm < 0.0) return 0.0;
    // Map normalized id to packed 2D texture coordinates
    float idxNorm = clamp(idNorm, 0.0, 1.0);
    float maxIndex = max(1.0, u_seedCount - 1.0);
    float index = idxNorm * maxIndex;
    float w = u_seedTexDims.x;
    float h = u_seedTexDims.y;
    float x = mod(index, w);
    float y = floor(index / w);
    vec2 uv = vec2((x + 0.5) / w, (y + 0.5) / h);
    return texture(u_seeds, uv).z;
}

void main() {
    vec4 nearest = texture(u_nearest, v_uv);
    if (nearest.z < 0.0) {
        out_dist = 0.0;
        return;
    }
    vec2 dUV = v_uv - nearest.xy;
    vec2 dPx = vec2(dUV.x * u_texSize.x, dUV.y * u_texSize.y);
    float distPx = length(dPx);
    if (u_signed) {
        float r = sampleSeedRadius(nearest.z);
        out_dist = distPx - r;
    } else {
        out_dist = distPx;
    }
}
`;
  const renderVoronoiSrc = `
// Render Voronoi cells by candidate ID and optional borders
in vec2 v_uv;
uniform sampler2D u_nearest;
uniform vec2 u_px;          // 1/texSize
uniform bool u_showBorders;
uniform float u_borderAlpha;
out vec4 out_color;

vec3 idToColor(float idNorm) {
    // Hash-based ID color; stable mapping from id
    float t = fract(sin(idNorm * 43758.5453) * 57.5831);
    return vec3(0.6 + 0.4 * sin(6.2831 * t), 0.6 + 0.4 * sin(6.2831 * (t + 0.33)), 0.6 + 0.4 * sin(6.2831 * (t + 0.66)));
}

bool isBorder(vec2 uv) {
    vec4 c = texture(u_nearest, uv);
    if (c.z < 0.0) return false;
    vec4 n = texture(u_nearest, uv + vec2(0.0,  u_px.y));
    vec4 s = texture(u_nearest, uv + vec2(0.0, -u_px.y));
    vec4 e = texture(u_nearest, uv + vec2( u_px.x, 0.0));
    vec4 w = texture(u_nearest, uv + vec2(-u_px.x, 0.0));
    // Border if any neighbor has different normalized id
    return (n.z != c.z) || (s.z != c.z) || (e.z != c.z) || (w.z != c.z);
}

void main() {
    vec4 nearest = texture(u_nearest, v_uv);
    if (nearest.z < 0.0) {
        out_color = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec3 baseColor = idToColor(nearest.z);
    float border = (u_showBorders && isBorder(v_uv)) ? 1.0 : 0.0;
    vec3 color = mix(baseColor, vec3(0.0), border);
    float alpha = mix(1.0, u_borderAlpha, border);
    out_color = vec4(color, alpha);
}
`;
  const renderSdfSrc = `
// Render SDF/DF with optional isolines
in vec2 v_uv;
uniform sampler2D u_dist;
uniform float u_isoFreq;
uniform bool u_showIsolines;
// Simple grayscale colormap
out vec4 out_color;

void main() {
    float d = texture(u_dist, v_uv).x;
    // Normalize by a rough scale to keep values in [0,1]
    float norm = clamp(d / 512.0, 0.0, 1.0);
    vec3 base = vec3(norm);
    if (u_showIsolines) {
        float iso = step(0.95, fract(d * u_isoFreq));
        base = mix(base, vec3(0.0), iso);
    }
    out_color = vec4(base, 1.0);
}
`;

  // Programas
  const clearNearest = setValueProgram(composer, {
    name: 'jfa_clear',
    type: nearest.type,
    value: [0, 0, -1, 0],
  });

  const seedProgram = new GPUProgram(composer, {
    name: 'jfa_seed',
    fragmentShader: jfaSeedSrc,
    uniforms: [ { name: 'u_seedCount', value: PARAMS.seedCount, type: FLOAT } ],
  });

  const jfaPass = new GPUProgram(composer, {
    name: 'jfa_pass',
    fragmentShader: jfaPassSrc,
    uniforms: [
      { name: 'u_nearest', value: 0, type: INT },
      { name: 'u_px', value: [1 / canvas.width, 1 / canvas.height], type: FLOAT },
      { name: 'u_texSize', value: [canvas.width, canvas.height], type: FLOAT },
      { name: 'u_jump', value: 1, type: FLOAT },
      { name: 'u_emptyId', value: -1, type: FLOAT },
    ],
  });

  const jfaRefine = new GPUProgram(composer, {
    name: 'jfa_refine',
    fragmentShader: jfaRefineSrc,
    uniforms: [
      { name: 'u_nearest', value: 0, type: INT },
      { name: 'u_px', value: [1 / canvas.width, 1 / canvas.height], type: FLOAT },
      { name: 'u_texSize', value: [canvas.width, canvas.height], type: FLOAT },
      { name: 'u_emptyId', value: -1, type: FLOAT },
    ],
  });

  const sdfFromVoronoi = new GPUProgram(composer, {
    name: 'sdf_from_voronoi',
    fragmentShader: sdfSrc,
    uniforms: [
      { name: 'u_nearest', value: 0, type: INT },
      { name: 'u_texSize', value: [canvas.width, canvas.height], type: FLOAT },
      { name: 'u_signed', value: PARAMS.signed, type: GPUIO.BOOL },
      { name: 'u_seeds', value: 1, type: INT },
      { name: 'u_seedCount', value: PARAMS.seedCount, type: FLOAT },
      { name: 'u_seedTexDims', value: [seedAttrs.width, seedAttrs.height], type: FLOAT },
    ],
  });

  const renderVoronoi = new GPUProgram(composer, {
    name: 'render_voronoi',
    fragmentShader: renderVoronoiSrc,
    uniforms: [
      { name: 'u_nearest', value: 0, type: INT },
      { name: 'u_px', value: [1 / canvas.width, 1 / canvas.height], type: FLOAT },
      { name: 'u_showBorders', value: PARAMS.showBorders, type: GPUIO.BOOL },
      { name: 'u_borderAlpha', value: PARAMS.borderAlpha, type: FLOAT },
    ],
  });

  const renderSdf = new GPUProgram(composer, {
    name: 'render_sdf',
    fragmentShader: renderSdfSrc,
    uniforms: [
      { name: 'u_dist', value: 0, type: INT },
      { name: 'u_isoFreq', value: PARAMS.isoFreq, type: FLOAT },
      { name: 'u_showIsolines', value: PARAMS.showIsolines, type: GPUIO.BOOL },
    ],
  });

  // Responsive resize
  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    composer.resize([width, height]);
    nearest.resize([width, height]);
    dist.resize([width, height]);
    jfaPass.setUniform('u_px', [1 / width, 1 / height], FLOAT);
    jfaPass.setUniform('u_texSize', [width, height], FLOAT);
    jfaRefine.setUniform('u_px', [1 / width, 1 / height], FLOAT);
    jfaRefine.setUniform('u_texSize', [width, height], FLOAT);
    renderVoronoi.setUniform('u_px', [1 / width, 1 / height], FLOAT);
    sdfFromVoronoi.setUniform('u_texSize', [width, height], FLOAT);
    const data = makeSeeds(PARAMS.seedCount);
    seedPositions.resize(PARAMS.seedCount, data.pos);
    seedAttrs.resize(PARAMS.seedCount, data.attrs);
    // Keep local references in sync
    pos = data.pos;
    attrs = data.attrs;
    sdfFromVoronoi.setUniform('u_seedTexDims', [seedAttrs.width, seedAttrs.height], FLOAT);
  }
  window.addEventListener('resize', onResize);

  // UI
  const ui = pane.addFolder({ title: 'JFA Voronoi + SDF' });
  let modeCtrl;
  try {
    modeCtrl = ui.addBlade({ view: 'segmented', label: 'Mode', options: [
      { text: 'Voronoi', value: 'voronoi' },
      { text: 'SDF', value: 'sdf' },
    ], value: PARAMS.showVoronoi ? 'voronoi' : 'sdf' });
    modeCtrl.on('change', (ev) => {
      const isVoronoi = ev.value === 'voronoi';
      PARAMS.showVoronoi = isVoronoi;
      PARAMS.showSDF = !isVoronoi;
    });
  } catch (_) {
    const modeFallback = ui.addInput(PARAMS, 'showVoronoi', { label: 'Voronoi mode' });
    modeFallback.on('change', () => { PARAMS.showSDF = !PARAMS.showVoronoi; });
  }
  const bordersCtrl = ui.addInput(PARAMS, 'showBorders', { label: 'Borders' });
  const borderAlphaCtrl = ui.addInput(PARAMS, 'borderAlpha', { label: 'Border alpha', min: 0, max: 1 });
  const seedCountCtrl = ui.addInput(PARAMS, 'seedCount', { label: 'Seed count', min: 8, max: 1024, step: 1 });
  const signedCtrl = ui.addInput(PARAMS, 'signed', { label: 'Signed SDF' });
  const isoCtrl = ui.addInput(PARAMS, 'showIsolines', { label: 'Isolines' });
  const isoFreqCtrl = ui.addInput(PARAMS, 'isoFreq', { label: 'Iso freq', min: 0.01, max: 0.2 });
  const refineCtrl = ui.addInput(PARAMS, 'refineAfterJfa', { label: 'Refine pass' });
  const randomizeBtn = ui.addButton({ title: 'Randomize Seeds' });

  bordersCtrl.on('change', () => renderVoronoi.setUniform('u_showBorders', PARAMS.showBorders, GPUIO.BOOL));
  borderAlphaCtrl.on('change', () => renderVoronoi.setUniform('u_borderAlpha', PARAMS.borderAlpha, FLOAT));
  signedCtrl.on('change', () => sdfFromVoronoi.setUniform('u_signed', PARAMS.signed, GPUIO.BOOL));
  isoCtrl.on('change', () => renderSdf.setUniform('u_showIsolines', PARAMS.showIsolines, GPUIO.BOOL));
  isoFreqCtrl.on('change', () => renderSdf.setUniform('u_isoFreq', PARAMS.isoFreq, FLOAT));
  refineCtrl.on('change', () => {});

  seedCountCtrl.on('change', () => {
    const count = Math.max(1, Math.floor(PARAMS.seedCount));
    const data = makeSeeds(count);
    seedPositions.resize(count, data.pos);
    seedAttrs.resize(count, data.attrs);
    pos = data.pos; attrs = data.attrs;
    sdfFromVoronoi.setUniform('u_seedCount', count, FLOAT);
    sdfFromVoronoi.setUniform('u_seedTexDims', [seedAttrs.width, seedAttrs.height], FLOAT);
    seedProgram.setUniform('u_seedCount', count, FLOAT);
  });

  randomizeBtn.on('click', () => {
    const data = makeSeeds(PARAMS.seedCount);
    seedPositions.resize(PARAMS.seedCount, data.pos);
    seedAttrs.resize(PARAMS.seedCount, data.attrs);
    pos = data.pos; attrs = data.attrs;
    sdfFromVoronoi.setUniform('u_seedCount', PARAMS.seedCount, FLOAT);
    sdfFromVoronoi.setUniform('u_seedTexDims', [seedAttrs.width, seedAttrs.height], FLOAT);
    seedProgram.setUniform('u_seedCount', PARAMS.seedCount, FLOAT);
  });

  // JFA passes
  function runJFA() {
    composer.step({ program: clearNearest, output: nearest });
    composer.drawLayerAsPoints({
      layer: seedPositions,
      program: seedProgram,
      output: nearest,
      pointSize: 1,
      useOutputScale: true,
      wrapX: false,
      wrapY: false,
    });
    const maxDim = Math.max(canvas.width, canvas.height);
    let jump = 1; while (jump * 2 <= maxDim) jump *= 2;
    for (let j = jump; j >= 1; j = Math.floor(j / 2)) {
      jfaPass.setUniform('u_jump', j, FLOAT);
      composer.step({ program: jfaPass, input: nearest, output: nearest });
    }
    if (PARAMS.refineAfterJfa) {
      composer.step({ program: jfaRefine, input: nearest, output: nearest });
    }
  }

  // Loop
  function loop() {
    runJFA();
    if (PARAMS.showVoronoi) {
      composer.step({ program: renderVoronoi, input: nearest });
    } else {
      composer.step({ program: sdfFromVoronoi, input: [nearest, seedAttrs], output: dist });
      composer.step({ program: renderSdf, input: dist });
    }
  }

  // Pointer interactivity: move seeds by dragging
  const activePointers = new Map();
  function toCanvasCoords(ev) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (ev.clientX - rect.left) * scaleX;
    const y = (ev.clientY - rect.top) * scaleY;
    return [x, y];
  }
  function findNearestSeed(x, y) {
    const count = seedPositions.length;
    let minD = Infinity, idx = 0;
    for (let i = 0; i < count; i++) {
      const dx = x - pos[2 * i];
      const dy = y - pos[2 * i + 1];
      const d = dx * dx + dy * dy;
      if (d < minD) { minD = d; idx = i; }
    }
    return idx;
  }
  function setSeedPosition(i, x, y) {
    pos[2 * i] = x; pos[2 * i + 1] = y;
    attrs[3 * i] = x; attrs[3 * i + 1] = y;
    seedPositions.setFromArray(pos);
    seedAttrs.setFromArray(attrs);
  }
  function onPointerStart(ev) {
    const [x, y] = toCanvasCoords(ev);
    const i = findNearestSeed(x, y);
    activePointers.set(ev.pointerId, i);
    setSeedPosition(i, x, y);
  }
  function onPointerMove(ev) {
    const i = activePointers.get(ev.pointerId);
    if (i === undefined) return;
    const [x, y] = toCanvasCoords(ev);
    setSeedPosition(i, x, y);
  }
  function onPointerStop(ev) { activePointers.delete(ev.pointerId); }
  canvas.addEventListener('pointerdown', onPointerStart);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerStop);
  canvas.addEventListener('pointercancel', onPointerStop);
  canvas.addEventListener('pointerleave', onPointerStop);

  // Cleanup
  function dispose() {
    document.body.removeChild(canvas);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('pointerdown', onPointerStart);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerStop);
    canvas.removeEventListener('pointercancel', onPointerStop);
    canvas.removeEventListener('pointerleave', onPointerStop);
    clearNearest.dispose();
    seedProgram.dispose();
    jfaPass.dispose();
    jfaRefine.dispose();
    sdfFromVoronoi.dispose();
    renderVoronoi.dispose();
    renderSdf.dispose();
    seedPositions.dispose();
    seedAttrs.dispose();
    nearest.dispose();
    dist.dispose();
    composer.dispose();
    pane.remove(ui);
  }

  return { loop, dispose, composer, canvas };
}