# JFA Voronoi + SDF (Auto-Performance Example)

This demo implements a Jump Flood Algorithm (JFA) to compute Voronoi cells and a Distance Field (DF/Signed DF) over the full screen, integrated with gpu-io's auto-performance controls.

## Overview
- Seeds are drawn as points; each pixel keeps its nearest seed candidate.
- JFA runs in powers-of-two jumps to propagate nearest candidates across the image.
- An optional 1‑px refine pass reduces residual errors.
- A second pass converts the Voronoi to a DF/SDF using seed attributes (position, radius).
- Rendering supports Voronoi cell coloring and SDF grayscale with optional isolines.

## Pipeline
1. Clear `nearest` layer to an empty candidate ID (vec4 `[seedUV.x, seedUV.y, id, 0]`).
2. Seed via `drawLayerAsPoints` using `jfa_seed.glsl` (writes per‑seed candidate).
3. Jump Flood passes (`jfa_pass.glsl`) from largest power of two down to 1.
4. Optional refine pass (`jfa_refine.glsl`) with fixed 1‑px neighborhood.
5. Distance field computation (`sdf_from_voronoi.glsl`) from `nearest` + `seedAttrs`.
6. Render either Voronoi (`render_voronoi.glsl`) or SDF (`render_sdf.glsl`).

## Controls
- `Mode`: Switch between `Voronoi` and `SDF`.
- `Borders` + `Border alpha`: Toggle and tune cell border emphasis.
- `Seed count`: Regenerate seeds; auto‑performance updates this dynamically.
- `Signed SDF`: Use seed radius to produce signed distances.
- `Isolines` + `Iso freq`: Overlay isolines over the SDF.
- `Refine pass`: Enable a final local refinement after JFA.
- `Randomize Seeds`: Recreate seed positions and radii.

## Auto-Performance
- The demo exposes `updateQuality(quality)` and maps `QUALITY_PRESETS` to `seedCount` and `refineAfterJfa`.
- Higher presets increase seed count and keep refine enabled; lower presets reduce count and may disable refine.

## Files
- `examples/jfa-voronoi-sdf/auto-performance.js`: Demo wiring, programs, UI (isolated module used by auto-performance).
- `examples/jfa-voronoi-sdf/shaders/*` or inline GLSL strings: JFA, SDF, and rendering shaders.

## Shortcuts
- `v`: Start/stop video capture (provided by wrapper).
- Mouse/touch: No direct interaction (seeds are randomized via UI button).

## Notes
- Shader varyings and uniforms follow gpu-io conventions: `drawLayerAsPoints` provides `v_index`, `v_uv_position`, and `v_position` in fragment shaders.
- `setValueProgram` initializes `nearest` as a `vec4` texture; JFA passes read/write the same layer.
- The demo uses `NEAREST` filtering for candidate IDs to avoid blending across texels.