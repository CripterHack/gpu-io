// Examples configuration and management
const EXAMPLES = {
    'fluid': {
        name: 'Fluid Simulation',
        description: 'Interactive fluid dynamics simulation with particle-based rendering',
        main: fluidMain
    },
    'reaction-diffusion': {
        name: 'Reaction Diffusion',
        description: 'Chemical reaction-diffusion patterns simulation',
        main: reactionDiffusionMain
    },
    'physarum': {
        name: 'Physarum Transport Network',
        description: 'Slime mold-inspired network formation simulation',
        main: physarumMain
    },
    'wave2d': {
        name: '2D Wave Equation',
        description: '2D wave propagation simulation',
        main: wave2dMain
    },
    'gol': {
        name: "Conway's Game of Life",
        description: 'Cellular automaton simulation',
        main: golMain
    },
    'fractal': {
        name: 'Julia Set Fractal',
        description: 'Interactive Julia set fractal renderer',
        main: fractalMain
    }
};

let currentExample = null;
let currentExampleDispose = null;

function switchExample(exampleId, pane, contextID, glslVersion) {
    // Dispose current example
    if (currentExampleDispose) {
        try {
            currentExampleDispose();
        } catch (error) {
            console.warn('Error disposing current example:', error);
        }
        currentExampleDispose = null;
    }
    
    // Clear any existing canvases (avoid stacking issues)
    document.querySelectorAll('canvas').forEach((c) => {
        if (c && c.parentNode) c.parentNode.removeChild(c);
    });
    
    // Conservar controles del wrapper; los ejemplos limpian su UI en dispose().
    // Evitamos borrar carpetas/botones globales. Si alguna UI residual queda,
    // estará cubierta por el dispose del ejemplo anterior.
    
    // Force garbage collection if available
    if (window.gc) {
        window.gc();
    }
    
    // Increased delay to ensure cleanup is complete and prevent race conditions
    return new Promise(async (resolve) => {
        setTimeout(async () => {
            // Load new example
            const example = EXAMPLES[exampleId];
            if (example && example.main) {
                try {
                    const result = await example.main({ pane, contextID, glslVersion });
                    currentExample = exampleId;
                    currentExampleDispose = result?.dispose;
                    resolve(result);
                } catch (error) {
                    console.error('Error initializing example:', error);
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        }, 250); // Increased delay from 100ms to 250ms for better cleanup
    });
}

// Fluid simulation main function
function fluidMain({ pane, contextID, glslVersion }) {
    // Call the fluidSimulation function from index.js
    if (typeof fluidSimulation === 'function') {
        return fluidSimulation({ pane, contextID, glslVersion });
    } else {
        console.error('fluidSimulation function not found');
        return { dispose: () => {} };
    }
}

// Placeholder functions for other examples
function reactionDiffusionMain({ pane, contextID, glslVersion }) {
    const performanceManager = new PerformanceManager();
    return reactionDiffusionSimulation({ pane, contextID, glslVersion, performanceManager });
}

// Physarum Transport Network Simulation
function physarumSimulation({ pane, contextID, glslVersion, performanceManager }) {
    const {
        GPUComposer,
        GPUProgram,
        GPULayer,
        INT,
        BOOL,
        FLOAT,
        REPEAT,
        LINEAR,
        renderAmplitudeProgram,
        addValueProgram,
    } = GPUIO;

    const PARAMS = {
        decayFactor: 0.9,
        depositAmount: 4,
        particleDensity: 0.35,
        sensorDistance: 18, 
        sensorAngle: 5.5,
        stepSize: 2,
        rotationAngle: 45,
        renderAmplitude: 0.03,
        currentPreset: 'Fibers',
        // Auto-performance parameters
        maxParticles: 100000,
        simSteps: 1,
    };

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const PARTICLES_NUM_COMPONENTS = 4;
    const composer = new GPUComposer({ canvas, glslVersion, contextID });

    // Calculate particles based on performance settings
    function initParticlesArrays() {
        const { width, height } = canvas;
        const baseParticles = Math.round(width * height * PARAMS.particleDensity);
        const numParticles = Math.min(baseParticles, PARAMS.maxParticles);
        
        const positions = new Float32Array(numParticles * PARTICLES_NUM_COMPONENTS);
        const heading = new Float32Array(numParticles);
        
        for (let i = 0; i < numParticles; i++) {
            positions[PARTICLES_NUM_COMPONENTS * i] = Math.random() * width;
            positions[PARTICLES_NUM_COMPONENTS * i + 1] = Math.random() * height;
            positions[PARTICLES_NUM_COMPONENTS * i + 2] = 0;
            positions[PARTICLES_NUM_COMPONENTS * i + 3] = 0;
            heading[i] = Math.random() * Math.PI * 2;
        }
        return { positions, heading, numParticles };
    }

    const { positions, heading, numParticles } = initParticlesArrays();

    const particlesPositions = new GPULayer(composer, {
        name: 'particlesPositions',
        dimensions: numParticles,
        numComponents: PARTICLES_NUM_COMPONENTS,
        type: FLOAT,
        numBuffers: 2,
        array: positions,
    });

    const particlesHeading = new GPULayer(composer, {
        name: 'particlesHeading',
        dimensions: numParticles,
        numComponents: 1,
        type: FLOAT,
        numBuffers: 2,
        array: heading,
    });

    const updateParticles = new GPUProgram(composer, {
        name: 'updateParticles',
        fragmentShader: `
            in vec2 v_uv;

            #define TWO_PI 6.28318530718

            uniform sampler2D u_particlesHeading;
            uniform sampler2D u_particlesPositions;
            uniform sampler2D u_trail;
            uniform vec2 u_dimensions;
            uniform float u_sensorAngle;
            uniform float u_sensorDistance;
            uniform float u_rotationAngle;
            uniform bool u_randomDir;
            uniform float u_stepSize;

            layout (location = 0) out float out_heading;
            layout (location = 1) out vec4 out_position;

            float sense(vec2 position, float angle) {
                vec2 sensePosition = position + u_sensorDistance * vec2(cos(angle), sin(angle));
                return texture(u_trail, sensePosition / u_dimensions).x;
            }

            void main() {
                float heading = texture(u_particlesHeading, v_uv).r;

                vec4 positionInfo = texture(u_particlesPositions, v_uv);
                vec2 absolute = positionInfo.xy;
                vec2 displacement = positionInfo.zw;
                vec2 position = absolute + displacement;

                float middleState = sense(position, heading);
                float leftState = sense(position, heading + u_sensorAngle);
                float rightState = sense(position, heading - u_sensorAngle);

                float rightWeight = step(middleState, rightState);
                float leftWeight = step(middleState, leftState);
                heading += mix(
                    rightWeight * mix(u_rotationAngle, -u_rotationAngle, float(u_randomDir)),
                    mix(u_rotationAngle, -u_rotationAngle, rightWeight),
                    abs(leftWeight - rightWeight)
                );

                heading = mod(heading + TWO_PI, TWO_PI);
                out_heading = heading;

                vec2 move = u_stepSize * vec2(cos(heading), sin(heading));
                vec2 nextDisplacement = displacement + move;
                
                float shouldMerge = step(30.0, dot(nextDisplacement, nextDisplacement));
                absolute = mod(absolute + shouldMerge * nextDisplacement + u_dimensions, u_dimensions);
                nextDisplacement *= (1.0 - shouldMerge);

                out_position = vec4(absolute, nextDisplacement);
            }`,
        uniforms: [
            {
                name: 'u_particlesHeading',
                value: 0,
                type: INT,
            },
            {
                name: 'u_particlesPositions',
                value: 1,
                type: INT,
            },
            {
                name: 'u_trail',
                value: 2,
                type: INT,
            },
            {
                name: 'u_dimensions',
                value: [canvas.width, canvas.height],
                type: FLOAT,
            },
            {
                name: 'u_sensorAngle',
                value: PARAMS.sensorAngle * Math.PI / 180,
                type: FLOAT,
            },
            {
                name: 'u_sensorDistance',
                value: PARAMS.sensorDistance,
                type: FLOAT,
            },
            {
                name: 'u_rotationAngle',
                value: PARAMS.rotationAngle * Math.PI / 180,
                type: FLOAT,
            },
            {
                name: 'u_randomDir',
                value: false,
                type: BOOL,
            },
            {
                name: 'u_stepSize',
                value: PARAMS.stepSize,
                type: FLOAT,
            },
        ],
    });

    const trail = new GPULayer(composer, {
        name: 'trail',
        dimensions: [canvas.width, canvas.height],
        numComponents: 1,
        type: FLOAT,
        filter: LINEAR,
        numBuffers: 2,
        wrapX: REPEAT,
        wrapY: REPEAT,
    });

    const deposit = addValueProgram(composer, {
        name: 'deposit',
        type: trail.type,
        value: PARAMS.depositAmount,
    });

    const diffuseAndDecay = new GPUProgram(composer, {
        name: 'diffuseAndDecay',
        fragmentShader: `
            in vec2 v_uv;

            uniform sampler2D u_trail;
            uniform float u_decayFactor;
            uniform vec2 u_pxSize;

            out float out_state;

            void main() {
                vec2 halfPx = u_pxSize / 2.0;
                float prevStateNE = texture(u_trail, v_uv + halfPx).x;
                float prevStateNW = texture(u_trail, v_uv + vec2(-halfPx.x, halfPx.y)).x;
                float prevStateSE = texture(u_trail, v_uv + vec2(halfPx.x, -halfPx.y)).x;
                float prevStateSW = texture(u_trail, v_uv - halfPx).x;
                float diffusedState = (prevStateNE + prevStateNW + prevStateSE + prevStateSW) / 4.0;
                out_state = u_decayFactor * diffusedState;
            }`,
        uniforms: [
            {
                name: 'u_trail',
                value: 0,
                type: INT,
            },
            {
                name: 'u_decayFactor',
                value: PARAMS.decayFactor,
                type: FLOAT,
            },
            {
                name: 'u_pxSize',
                value: [1 / canvas.width, 1 / canvas.height],
                type: FLOAT,
            },
        ],
    });

    const render = renderAmplitudeProgram(composer, {
        name: 'render',
        type: trail.type,
        components: 'x',
        scale: PARAMS.renderAmplitude,
    });

    // Auto-performance integration
    function updateQuality(quality) {
        const settings = QUALITY_PRESETS[quality];
        PARAMS.maxParticles = Math.round(settings.maxParticles * 0.8);
        PARAMS.particleDensity = settings.particleDensity * 0.5;
        
        // Reinitialize particles with new density
        const { positions, heading, numParticles } = initParticlesArrays();
        particlesPositions.resize(numParticles, positions);
        particlesHeading.resize(numParticles, heading);
    }

    // Render loop
    function loop() {
        for (let i = 0; i < PARAMS.simSteps; i++) {
            updateParticles.setUniform('u_randomDir', Math.random() < 0.5);
            
            composer.step({
                program: updateParticles,
                input: [particlesHeading, particlesPositions, trail],
                output: [particlesHeading, particlesPositions],
            });

            composer.drawLayerAsPoints({
                layer: particlesPositions,
                program: deposit,
                input: trail,
                output: trail,
                pointSize: 1,
                wrapX: true,
                wrapY: true,
            });

            composer.step({
                program: diffuseAndDecay,
                input: trail,
                output: trail,
            });
        }

        composer.step({
            program: render,
            input: trail,
        });
    }

    // Touch events
    const activeTouches = {};
    const TOUCH_DIAMETER = 25;
    
    function onPointerMove(e) {
        const lastPosition = activeTouches[e.pointerId];
        if (lastPosition) {
            const currentPosition = [e.clientX, canvas.height - e.clientY];
            composer.stepSegment({
                program: deposit,
                input: trail,
                output: trail,
                position1: currentPosition,
                position2: lastPosition,
                thickness: TOUCH_DIAMETER,
                endCaps: true,
            });
            activeTouches[e.pointerId] = currentPosition;
        }
    }

    function onPointerStart(e) {
        const currentPosition = [e.clientX, canvas.height - e.clientY];
        composer.stepCircle({
            program: deposit,
            input: trail,
            output: trail,
            position: currentPosition,
            diameter: TOUCH_DIAMETER,
        });
        activeTouches[e.pointerId] = currentPosition;
    }

    function onPointerStop(e) {
        delete activeTouches[e.pointerId];
    }

    // Resize handler
    function onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        composer.resize([width, height]);

        const { positions, heading, numParticles } = initParticlesArrays();
        particlesPositions.resize(numParticles, positions);
        particlesHeading.resize(numParticles, heading);

        trail.resize([width, height]);

        diffuseAndDecay.setUniform('u_pxSize', [1 / width, 1 / height]);
        updateParticles.setUniform('u_dimensions', [width, height]);
    }

    // Event listeners
    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerStart);
    canvas.addEventListener('pointerup', onPointerStop);
    canvas.addEventListener('pointerout', onPointerStop);
    canvas.addEventListener('pointercancel', onPointerStop);

    onResize();

    // Tweakpane controls
    const particlesGUI = pane.addFolder({
        expanded: false,
        title: `Particles (${particlesPositions.length.toLocaleString("en-US")})`,
    });
    
    particlesGUI.addInput(PARAMS, 'sensorAngle', { min: 0, max: 180, step: 0.01, label: 'Sensor Angle' }).on('change', () => {
        updateParticles.setUniform('u_sensorAngle', PARAMS.sensorAngle * Math.PI / 180);
    });
    
    particlesGUI.addInput(PARAMS, 'sensorDistance', { min: 1, max: 30, step: 0.01, label: 'Sensor Distance' }).on('change', () => {
        updateParticles.setUniform('u_sensorDistance', PARAMS.sensorDistance);
    });
    
    particlesGUI.addInput(PARAMS, 'rotationAngle', { min: -90, max: 90, step: 0.01, label: 'Rotation Angle' }).on('change', () => {
        updateParticles.setUniform('u_rotationAngle', PARAMS.rotationAngle * Math.PI / 180);
    });
    
    particlesGUI.addInput(PARAMS, 'stepSize', { min: 0.01, max: 3, step: 0.01, label: 'Step Size' }).on('change', () => {
        updateParticles.setUniform('u_stepSize', PARAMS.stepSize);
    });

    const trailsGUI = pane.addFolder({
        expanded: false,
        title: 'Trails',
    });
    
    trailsGUI.addInput(PARAMS, 'depositAmount', { min: 0, max: 10, step: 0.01, label: 'Deposit Amount' }).on('change', () => {
        deposit.setUniform('u_value', PARAMS.depositAmount);
    });
    
    trailsGUI.addInput(PARAMS, 'decayFactor', { min: 0, max: 1, step: 0.01, label: 'Decay Factor' }).on('change', () => {
        diffuseAndDecay.setUniform('u_decayFactor', PARAMS.decayFactor);
    });

    const renderGUI = pane.addFolder({
        expanded: false,
        title: 'Render Settings',
    });
    
    renderGUI.addInput(PARAMS, 'renderAmplitude', { min: 0, max: 1, step: 0.01, label: 'Amplitude' }).on('change', () => {
        render.setUniform('u_scale', PARAMS.renderAmplitude);
    });

    function dispose() {
        document.body.removeChild(canvas);
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerStart);
        canvas.removeEventListener('pointerup', onPointerStop);
        canvas.removeEventListener('pointerout', onPointerStop);
        canvas.removeEventListener('pointercancel', onPointerStop);
        
        particlesPositions.dispose();
        particlesHeading.dispose();
        updateParticles.dispose();
        trail.dispose();
        deposit.dispose();
        diffuseAndDecay.dispose();
        render.dispose();
        composer.dispose();
        
        pane.remove(particlesGUI);
        pane.remove(trailsGUI);
        pane.remove(renderGUI);
    }

    return {
        loop,
        dispose,
        composer,
        canvas,
        updateQuality,
    };
}

function golSimulation({ pane, contextID, glslVersion, performanceManager }) {
    const {
        GPUComposer,
        GPUProgram,
        GPULayer,
        BYTE,
        INT,
        UINT,
        FLOAT,
        REPEAT,
        renderAmplitudeProgram,
        copyProgram,
        PRECISION_LOW_P,
    } = GPUIO;

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const composer = new GPUComposer({ canvas, contextID, glslVersion });

    // Quality-based scaling
    const quality = performanceManager.getCurrentQuality();
    const scaleFactor = quality === 'high' ? 1.0 : quality === 'medium' ? 0.7 : 0.5;
    const dimensions = [
        Math.floor(window.innerWidth * scaleFactor),
        Math.floor(window.innerHeight * scaleFactor)
    ];

    const PARAMS = {
        survivalRules: Number.parseInt('00000110', 2), // Standard Conway's rules
        s1: false, s2: true, s3: true, s4: false, s5: false, s6: false, s7: false, s8: false,
        birthRules: Number.parseInt('00000100', 2),
        b1: false, b2: false, b3: true, b4: false, b5: false, b6: false, b7: false, b8: false,
        seedRatio: 0.12,
    };

    // Create state layer
    const state = new GPULayer(composer, {
        name: 'gol_state',
        dimensions: dimensions,
        numComponents: 1,
        type: BYTE,
        numBuffers: 2,
        wrapX: REPEAT,
        wrapY: REPEAT,
    });

    // Game of Life rules program
    const golRules = new GPUProgram(composer, {
        name: 'golRules',
        fragmentShader: `
            in vec2 v_uv;

            uniform vec2 u_pxSize;
            uniform lowp isampler2D u_state;
            uniform lowp uint u_survivalRules;
            uniform lowp uint u_birthRules;

            out lowp int out_state;

            void main() {
                lowp int state = int(texture(u_state, v_uv).r);
                lowp int n = int(texture(u_state, v_uv + vec2(0, u_pxSize[1])).r);
                lowp int s = int(texture(u_state, v_uv + vec2(0, -u_pxSize[1])).r);
                lowp int e = int(texture(u_state, v_uv + vec2(u_pxSize[0], 0)).r);
                lowp int w = int(texture(u_state, v_uv + vec2(-u_pxSize[0], 0)).r);
                lowp int ne = int(texture(u_state, v_uv + vec2(u_pxSize[0], u_pxSize[1])).r);
                lowp int nw = int(texture(u_state, v_uv + vec2(-u_pxSize[0], u_pxSize[1])).r);
                lowp int se = int(texture(u_state, v_uv + vec2(u_pxSize[0], -u_pxSize[1])).r);
                lowp int sw = int(texture(u_state, v_uv + vec2(-u_pxSize[0], -u_pxSize[1])).r);
                lowp int numLiving = n + s + e + w + ne + nw + se + sw;
                
                lowp uint mask = bitwiseAnd8((u_survivalRules * uint(state) + u_birthRules * uint(1 - state)), uint(bitshiftLeft(1, numLiving - 1)));
                state = min(int(mask), 1);

                out_state = state;
            }`,
        uniforms: [
            { name: 'u_state', value: 0, type: INT },
            { name: 'u_pxSize', value: [1 / dimensions[0], 1 / dimensions[1]], type: FLOAT },
            { name: 'u_survivalRules', value: PARAMS.survivalRules, type: UINT },
            { name: 'u_birthRules', value: PARAMS.birthRules, type: UINT },
        ],
    });

    // Render program
    const golRender = renderAmplitudeProgram(composer, {
        name: 'golRender',
        type: state.type,
        components: 'x',
        precision: PRECISION_LOW_P,
    });

    // Noise layer for touch interactions
    const noise = new GPULayer(composer, {
        name: 'gol_noise',
        dimensions: dimensions,
        numComponents: 1,
        type: BYTE,
        numBuffers: 1,
        wrapX: REPEAT,
        wrapY: REPEAT,
    });

    const touch = copyProgram(composer, {
        name: 'golTouch',
        type: noise.type,
        precision: PRECISION_LOW_P,
    });

    // Touch interaction
    const activeTouches = {};
    function onPointerMove(e) {
        if (activeTouches[e.pointerId]) {
            composer.stepCircle({
                program: touch,
                input: noise,
                output: state,
                position: [e.clientX, canvas.height - e.clientY],
                diameter: 30,
            });
        }
    }
    function onPointerStop(e) { delete activeTouches[e.pointerId]; }
    function onPointerStart(e) { activeTouches[e.pointerId] = true; }

    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerStart);
    canvas.addEventListener('pointerup', onPointerStop);
    canvas.addEventListener('pointerout', onPointerStop);
    canvas.addEventListener('pointercancel', onPointerStop);

    // Helper function for rule changes
    function changeBit(key, bit, index) {
        const mask = 1 << index;
        if (bit) {
            PARAMS[key] |= mask;
        } else {
            PARAMS[key] &= ((~mask) & 255);
        }
        golRules.setUniform(`u_${key}`, PARAMS[key]);
    }

    // Tweakpane controls
    const survival = pane.addFolder({ expanded: false, title: 'Survival Rules' });
    for (let i = 0; i < 8; i++) {
        const key = `s${i + 1}`;
        survival.addInput(PARAMS, key).on('change', () => {
            changeBit('survivalRules', PARAMS[key], i);
        });
    }

    const birth = pane.addFolder({ expanded: false, title: 'Birth Rules' });
    for (let i = 0; i < 8; i++) {
        const key = `b${i + 1}`;
        birth.addInput(PARAMS, key).on('change', () => {
            changeBit('birthRules', PARAMS[key], i);
        });
    }

    const seedRatioControl = pane.addInput(PARAMS, 'seedRatio', { 
        min: 0, max: 1, step: 0.01, label: 'Seed Ratio' 
    }).on('change', (e) => {
        if (e && !e.last) return;
        initializeState();
    });

    const resetButton = pane.addButton({ title: 'Reset' }).on('click', initializeState);

    // Initialize state with random pattern
    function initializeState() {
        const array = new Uint8Array(dimensions[0] * dimensions[1]);
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.random() < PARAMS.seedRatio ? 1 : 0;
        }
        noise.resize(dimensions, array);
        state.resize(dimensions, array);
    }

    // Quality update function
    function updateQuality(newQuality) {
        const newScaleFactor = newQuality === 'high' ? 1.0 : newQuality === 'medium' ? 0.7 : 0.5;
        const newDimensions = [
            Math.floor(window.innerWidth * newScaleFactor),
            Math.floor(window.innerHeight * newScaleFactor)
        ];
        
        composer.resize(newDimensions);
        state.resize(newDimensions);
        noise.resize(newDimensions);
        golRules.setUniform('u_pxSize', [1 / newDimensions[0], 1 / newDimensions[1]]);
        
        initializeState();
    }

    // Initialize
    initializeState();

    // Simulation loop
    function loop() {
        // Update Game of Life
        composer.step({
            program: golRules,
            input: state,
            output: state,
        });

        // Render
        composer.step({
            program: golRender,
            input: state,
        });
    }

    // Cleanup function
    function dispose() {
        document.body.removeChild(canvas);
        
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerStart);
        canvas.removeEventListener('pointerup', onPointerStop);
        canvas.removeEventListener('pointerout', onPointerStop);
        canvas.removeEventListener('pointercancel', onPointerStop);
        
        golRules.dispose();
        golRender.dispose();
        touch.dispose();
        state.dispose();
        noise.dispose();
        composer.dispose();
        
        pane.remove(survival);
        pane.remove(birth);
        pane.remove(seedRatioControl);
        pane.remove(resetButton);
    }

    return {
        loop,
        dispose,
        composer,
        canvas,
        updateQuality,
    };
}

function fractalSimulation({ pane, contextID, glslVersion, performanceManager }) {
    const {
        GPUComposer,
        GPULayer,
        GPUProgram,
        FLOAT,
        renderAmplitudeProgram,
    } = GPUIO;

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const composer = new GPUComposer({ canvas, contextID, glslVersion });

    const RADIUS = 1.75;

    // Quality-based scaling
    const quality = performanceManager.getCurrentQuality();
    const scaleFactor = quality === 'high' ? 1.0 : quality === 'medium' ? 0.8 : 0.6;
    const dimensions = [
        Math.floor(window.innerWidth * scaleFactor),
        Math.floor(window.innerHeight * scaleFactor)
    ];

    // Calculate initial bounds
    function calcInitialBounds() {
        const aspectRatio = dimensions[0] / dimensions[1];
        return {
            min: aspectRatio > 1 ? [-RADIUS * aspectRatio, -RADIUS] : [-RADIUS, -RADIUS / aspectRatio],
            max: aspectRatio > 1 ? [RADIUS * aspectRatio, RADIUS] : [RADIUS, RADIUS / aspectRatio],
        };
    }
    let bounds = calcInitialBounds();

    const PARAMS = {
        cReal: 0.38,
        cImaginary: -0.23,
        maxIters: quality === 'high' ? 500 : quality === 'medium' ? 300 : 150,
        pngScaleFactor: 10,
    };

    let needsCompute = true;

    const state = new GPULayer(composer, {
        name: 'fractal_state',
        dimensions: dimensions,
        type: FLOAT,
        numComponents: 1,
    });

    const fractalCompute = new GPUProgram(composer, {
        name: 'fractalCompute',
        fragmentShader: `
            #define SUBSAMPLE_RES ${quality === 'high' ? '2.0' : '1.0'}

            in vec2 v_uv;

            uniform vec2 u_boundsMin;
            uniform vec2 u_boundsMax;
            uniform float u_cReal;
            uniform float u_cImaginary;
            uniform vec2 u_pxSize;

            out float out_value;

            void main() {
                int value = 0;
                for (float u = 0.0; u < SUBSAMPLE_RES; u++) {
                    for (float v = 0.0; v < SUBSAMPLE_RES; v++) {
                        vec2 uvOffset = vec2(u, v) / (SUBSAMPLE_RES + 1.0) + 0.5;
                        vec2 uv = v_uv + uvOffset * u_pxSize;
                        vec2 z = uv * u_boundsMax + (1.0 - uv) * u_boundsMin;
                        for (int i = 0; i < MAX_ITERS; i++) {
                            if (z.x * z.x + z.y * z.y > ${(RADIUS * RADIUS).toFixed(1)}) break;
                            float xTemp = z.x * z.x - z.y * z.y;
                            z.y = 2.0 * z.x * z.y + u_cImaginary;
                            z.x = xTemp + u_cReal;
                            value += 1;
                        }
                    }
                }
                out_value = (float(value) / (SUBSAMPLE_RES * SUBSAMPLE_RES)) / float(MAX_ITERS);
            }`,
        uniforms: [
            { name: 'u_boundsMin', value: bounds.min, type: FLOAT },
            { name: 'u_boundsMax', value: bounds.max, type: FLOAT },
            { name: 'u_cReal', value: PARAMS.cReal, type: FLOAT },
            { name: 'u_cImaginary', value: PARAMS.cImaginary, type: FLOAT },
            { name: 'u_pxSize', value: [1 / dimensions[0], 1 / dimensions[1]], type: FLOAT },
        ],
        compileTimeConstants: { MAX_ITERS: `${PARAMS.maxIters}` },
    });

    const fractalRender = renderAmplitudeProgram(composer, {
        name: 'fractalRender',
        type: state.type,
        components: 'x',
    });

    // Touch interaction
    const activeTouches = {};
    let pinchPan;

    function onPinchZoom(e) {
        if (e.preventDefault) e.preventDefault();
        const factor = e.ctrlKey ? 0.005 : 0.001;
        let [minX, minY] = bounds.min;
        let [maxX, maxY] = bounds.max;
        let scaleX = maxY - minY;
        let scaleY = maxX - minX;
        const fractionY = (canvas.height - e.clientY) / canvas.height;
        const fractionX = e.clientX / canvas.width;
        const centerY = fractionY * scaleX + minY;
        const centerX = fractionX * scaleY + minX;
        const scale = 1.0 + e.deltaY * factor;
        const scaleLimit = 1e-4;
        if (Math.min(scaleX * scale, scaleY * scale) < scaleLimit) return;
        scaleX = scaleX * scale;
        scaleY = scaleY * scale;
        bounds.min[0] = centerX - scaleY * fractionX;
        bounds.max[0] = centerX + scaleY * (1 - fractionX);
        bounds.min[1] = centerY - scaleX * fractionY;
        bounds.max[1] = centerY + scaleX * (1 - fractionY);
        fractalCompute.setUniform('u_boundsMin', bounds.min);
        fractalCompute.setUniform('u_boundsMax', bounds.max);
        needsCompute = true;
    }

    function onPan(e) {
        const { deltaX, deltaY } = e;
        const [minX, minY] = bounds.min;
        const [maxX, maxY] = bounds.max;
        const scaleX = maxY - minY;
        const scaleY = maxX - minX;
        const scaledDeltaX = deltaX / canvas.width;
        const scaledDeltaY = -deltaY / canvas.height;
        bounds.min[1] -= scaleX * scaledDeltaY;
        bounds.max[1] -= scaleX * scaledDeltaY;
        bounds.min[0] -= scaleY * scaledDeltaX;
        bounds.max[0] -= scaleY * scaledDeltaX;
        fractalCompute.setUniform('u_boundsMin', bounds.min);
        fractalCompute.setUniform('u_boundsMax', bounds.max);
        needsCompute = true;
    }

    function getAvgAndDeltaBetweenPoints(id1, id2) {
        const diffX = activeTouches[id1][0] - activeTouches[id2][0];
        const diffY = activeTouches[id1][1] - activeTouches[id2][1];
        const delta = Math.sqrt(diffX * diffX + diffY * diffY);
        const avg = [
            (activeTouches[id1][0] + activeTouches[id2][0]) / 2,
            (activeTouches[id1][1] + activeTouches[id2][1]) / 2,
        ];
        return { avg, delta };
    }

    function onPointerMove(e) {
        if (!activeTouches[e.pointerId]) return;
        e.preventDefault();
        const pointers = Object.keys(activeTouches);
        if (pointers.length === 1) {
            if (e.which === 3 || e.button === 2 || e.buttons === 2) {
                onPan({
                    deltaX: e.clientX - activeTouches[e.pointerId][0],
                    deltaY: e.clientY - activeTouches[e.pointerId][1],
                });
            }
            activeTouches[e.pointerId] = [e.clientX, e.clientY];
        } else if (pinchPan && pointers.length === 2) {
            const { id1, id2, lastDelta, lastAvg } = pinchPan;
            activeTouches[e.pointerId] = [e.clientX, e.clientY];
            const { delta, avg } = getAvgAndDeltaBetweenPoints(id1, id2);
            onPinchZoom({
                pointerId: e.pointerId,
                clientX: avg[0],
                clientY: avg[1],
                deltaY: lastDelta - delta,
                ctrlKey: true,
            });
            onPan({
                pointerId: e.pointerId,
                deltaX: avg[0] - lastAvg[0],
                deltaY: avg[1] - lastAvg[1],
            });
            pinchPan.lastDelta = delta;
            pinchPan.lastAvg = avg;
        }
    }

    function onPointerStop(e) {
        delete activeTouches[e.pointerId];
        if (Object.keys(activeTouches).length !== 2) {
            pinchPan = undefined;
        }
    }

    function onPointerStart(e) {
        e.preventDefault();
        activeTouches[e.pointerId] = [e.clientX, e.clientY];
        const pointers = Object.keys(activeTouches);
        if (pointers.length === 2) {
            pinchPan = {};
            pinchPan.id1 = pointers[0];
            pinchPan.id2 = pointers[1];
            const { delta, avg } = getAvgAndDeltaBetweenPoints(pointers[0], pointers[1]);
            pinchPan.lastDelta = delta;
            pinchPan.lastAvg = avg;
        } else {
            pinchPan = undefined;
        }
    }

    function onContextMenu(e) {
        e.preventDefault();
        return false;
    }

    // Event listeners
    window.addEventListener('wheel', onPinchZoom, { passive: false });
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerStart);
    canvas.addEventListener('pointerup', onPointerStop);
    canvas.addEventListener('pointerout', onPointerStop);
    canvas.addEventListener('pointercancel', onPointerStop);
    canvas.addEventListener('contextmenu', onContextMenu);

    function reset() {
        bounds = calcInitialBounds();
        fractalCompute.setUniform('u_boundsMin', bounds.min);
        fractalCompute.setUniform('u_boundsMax', bounds.max);
        needsCompute = true;
    }

    // Tweakpane controls
    const fractalGUI = pane.addFolder({
        expanded: false,
        title: 'Julia Set Parameters',
    });

    fractalGUI.addInput(PARAMS, 'cReal', { min: -2, max: 2, step: 0.01, label: 'C Real' }).on('change', () => {
        fractalCompute.setUniform('u_cReal', PARAMS.cReal);
        needsCompute = true;
    });

    fractalGUI.addInput(PARAMS, 'cImaginary', { min: -2, max: 2, step: 0.01, label: 'C Imaginary' }).on('change', () => {
        fractalCompute.setUniform('u_cImaginary', PARAMS.cImaginary);
        needsCompute = true;
    });

    fractalGUI.addInput(PARAMS, 'maxIters', { min: 1, max: 1000, step: 1, label: 'Max Iterations' }).on('change', () => {
        fractalCompute.recompile({ MAX_ITERS: `${PARAMS.maxIters}` });
        needsCompute = true;
    });

    const resetButton = fractalGUI.addButton({ title: 'Reset View' }).on('click', reset);

    // Quality update function
    function updateQuality(newQuality) {
        const newScaleFactor = newQuality === 'high' ? 1.0 : newQuality === 'medium' ? 0.8 : 0.6;
        const newDimensions = [
            Math.floor(window.innerWidth * newScaleFactor),
            Math.floor(window.innerHeight * newScaleFactor)
        ];
        
        const newMaxIters = newQuality === 'high' ? 500 : newQuality === 'medium' ? 300 : 150;
        
        composer.resize(newDimensions);
        state.resize(newDimensions);
        fractalCompute.setUniform('u_pxSize', [1 / newDimensions[0], 1 / newDimensions[1]]);
        
        if (PARAMS.maxIters !== newMaxIters) {
            PARAMS.maxIters = newMaxIters;
            fractalCompute.recompile({ MAX_ITERS: `${PARAMS.maxIters}` });
        }
        
        bounds = calcInitialBounds();
        fractalCompute.setUniform('u_boundsMin', bounds.min);
        fractalCompute.setUniform('u_boundsMax', bounds.max);
        needsCompute = true;
    }

    // Simulation loop
    function loop() {
        if (needsCompute) {
            composer.step({
                program: fractalCompute,
                output: state,
            });
            needsCompute = false;

            composer.step({
                program: fractalRender,
                input: state,
            });
        }
    }

    // Cleanup function
    function dispose() {
        document.body.removeChild(canvas);
        
        window.removeEventListener('wheel', onPinchZoom);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerStart);
        canvas.removeEventListener('pointerup', onPointerStop);
        canvas.removeEventListener('pointerout', onPointerStop);
        canvas.removeEventListener('pointercancel', onPointerStop);
        canvas.removeEventListener('contextmenu', onContextMenu);
        
        fractalCompute.dispose();
        fractalRender.dispose();
        state.dispose();
        composer.dispose();
        
        pane.remove(fractalGUI);
    }

    return {
        loop,
        dispose,
        composer,
        canvas,
        updateQuality,
    };
}

function fractalMain({ pane, contextID, glslVersion }) {
    // Create performance manager for fractal simulation
    const performanceManager = {
        getCurrentQuality: () => 'medium', // Default quality
        updateQuality: (quality) => {
            // no-op in production
        }
    };
    return fractalSimulation({ pane, contextID, glslVersion, performanceManager });
}

function golMain({ pane, contextID, glslVersion }) {
    // Create performance manager for Game of Life simulation
    const performanceManager = {
        getCurrentQuality: () => 'medium', // Default quality
        updateQuality: (quality) => {
            // no-op in production
        }
    };
    return golSimulation({ pane, contextID, glslVersion, performanceManager });
}

function physarumMain({ pane, contextID, glslVersion }) {
    // Create performance manager for Physarum simulation
    const performanceManager = {
        updateQuality: (quality) => {
            // no-op in production
        }
    };
    return physarumSimulation({ pane, contextID, glslVersion, performanceManager });
}

// Reaction Diffusion Simulation
function reactionDiffusionSimulation({ pane, contextID, glslVersion, performanceManager }) {
    if (typeof TweakpaneEssentialsPlugin !== 'undefined' && TweakpaneEssentialsPlugin) {
        pane.registerPlugin(TweakpaneEssentialsPlugin);
    }

    const {
        GPUComposer,
        GPUProgram,
        GPULayer,
        FLOAT,
        INT,
        CLAMP_TO_EDGE,
        LINEAR,
        renderAmplitudeProgram,
        setValueProgram,
    } = GPUIO;

    const PARAMS = {
        diffusionA: 0.2097,
        diffusionB: 0.105,
        renderLayer: 'Chemical B',
        removalRate: {
            min: 0.05,
            max: 0.066,
        },
        feedRate: {
            min: 0.016,
            max: 0.044,
        },
        // Auto-performance parameters
        simSteps: 10,
        simScale: 1.5,
    };

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    const composer = new GPUComposer({ canvas, contextID, glslVersion });
    let SIM_SCALE = PARAMS.simScale;

    const state = new GPULayer(composer, {
        name: 'state',
        dimensions: [Math.round(canvas.width / SIM_SCALE), Math.round(canvas.height / SIM_SCALE)],
        numComponents: 2,
        type: FLOAT,
        filter: LINEAR,
        numBuffers: 2,
        wrapX: CLAMP_TO_EDGE,
        wrapY: CLAMP_TO_EDGE,
    });

    const rxnDiffusion = new GPUProgram(composer, {
        name: 'rxnDiffusion',
        fragmentShader: `
            in vec2 v_uv;

            uniform sampler2D u_state;
            uniform vec2 u_pxSize;
            uniform vec2 u_feedRateBounds;
            uniform vec2 u_removalRateBounds;
            uniform float u_diffusionA;
            uniform float u_diffusionB;

            out vec2 out_state;

            void main() {
                // Calculate the laplacian of u_state.
                vec2 state = texture(u_state, v_uv).xy;
                vec2 n = texture(u_state, v_uv + vec2(u_pxSize.x, 0)).xy;
                vec2 s = texture(u_state, v_uv + vec2(-u_pxSize.x, 0)).xy;
                vec2 e = texture(u_state, v_uv + vec2(0, u_pxSize.y)).xy;
                vec2 w = texture(u_state, v_uv + vec2(0, -u_pxSize.y)).xy;
                vec2 laplacian = (n + s + e + w) - 4.0 * state;

                float reaction = state.x * state.y * state.y;
                float removalRate = mix(u_removalRateBounds.x, u_removalRateBounds.y, v_uv.x);
                float feedRate = mix(u_feedRateBounds.x, u_feedRateBounds.y, v_uv.y);
                out_state = clamp(state + vec2(
                    u_diffusionA * laplacian.x - reaction + feedRate * (1.0 - state.x),
                    u_diffusionB * laplacian.y + reaction - (removalRate + feedRate) * state.y
                ), 0.0, 1.0);
            }
        `,
        uniforms: [
            {
                name: 'u_state',
                value: 0,
                type: INT,
            },
            {
                name: 'u_pxSize',
                value: [SIM_SCALE / canvas.width, SIM_SCALE / canvas.height],
                type: FLOAT,
            },
            {
                name: 'u_feedRateBounds',
                value: [PARAMS.feedRate.min, PARAMS.feedRate.max],
                type: FLOAT,
            },
            {
                name: 'u_removalRateBounds',
                value: [PARAMS.removalRate.min, PARAMS.removalRate.max],
                type: FLOAT,
            },
            {
                name: 'u_diffusionA',
                value: PARAMS.diffusionA,
                type: FLOAT,
            },
            {
                name: 'u_diffusionB',
                value: PARAMS.diffusionB,
                type: FLOAT,
            },
        ]
    });

    const renderA = renderAmplitudeProgram(composer, {
        name: 'renderA',
        type: state.type,
        scale: 1,
        components: 'x',
    });

    const renderB = renderAmplitudeProgram(composer, {
        name: 'renderB',
        type: state.type,
        scale: 3,
        components: 'y',
    });

    // Touch interaction
    const touch = setValueProgram(composer, {
        name: 'touch',
        type: state.type,
        value: [0.5, 0.5],
    });

    // Auto-performance integration
    function updateQuality(quality) {
        const settings = QUALITY_PRESETS[quality];
        PARAMS.simSteps = Math.max(1, Math.round(settings.numRenderSteps * 0.5));
        SIM_SCALE = 2.0 - (settings.particleDensity * 0.5);
        
        // Update simulation scale
        const newDimensions = [
            Math.round(canvas.width / SIM_SCALE), 
            Math.round(canvas.height / SIM_SCALE)
        ];
        
        // Resize state layer
        const initialState = new Float32Array(newDimensions[0] * newDimensions[1] * 2);
        for (let i = 0; i < initialState.length / 2; i++) {
            initialState[2 * i] = 0.5 + Math.random() * 0.5;
            initialState[2 * i + 1] = 0.5 + Math.random() * 0.5;
        }
        state.resize(newDimensions, initialState);
        
        // Update uniforms
        rxnDiffusion.setUniform('u_pxSize', [SIM_SCALE / canvas.width, SIM_SCALE / canvas.height]);
    }

    // Render loop
    function loop() {
        for (let i = 0; i < PARAMS.simSteps; i++) {
            composer.step({
                program: rxnDiffusion,
                input: state,
                output: state,
            });
        }
        
        composer.step({
            program: PARAMS.renderLayer === 'Chemical A' ? renderA : renderB,
            input: state,
        });
    }

    // Resize handler
    function onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        composer.resize([width, height]);

        const initialState = new Float32Array(Math.round(width / SIM_SCALE) * Math.round(height / SIM_SCALE) * 2);
        for (let i = 0; i < initialState.length / 2; i++) {
            initialState[2 * i] = 0.5 + Math.random() * 0.5;
            initialState[2 * i + 1] = 0.5 + Math.random() * 0.5;
        }
        state.resize([Math.round(width / SIM_SCALE), Math.round(height / SIM_SCALE)], initialState);
        rxnDiffusion.setUniform('u_pxSize', [SIM_SCALE / width, SIM_SCALE / height]);
    }

    // Touch events
    const activeTouches = {};
    function onPointerMove(e) {
        if (!activeTouches[e.pointerId]) return;
        e.preventDefault();
        
        if (!(e.which === 3 || e.button === 2 || e.buttons === 2)) {
            composer.stepCircle({
                program: touch,
                output: state,
                position: [e.clientX, canvas.height - e.clientY],
                diameter: 30,
            });
        }
        activeTouches[e.pointerId] = [e.clientX, e.clientY];
    }

    function onPointerStart(e) {
        e.preventDefault();
        activeTouches[e.pointerId] = [e.clientX, e.clientY];
    }

    function onPointerStop(e) {
        delete activeTouches[e.pointerId];
    }

    // Event listeners
    window.addEventListener('resize', onResize);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerStart);
    canvas.addEventListener('pointerup', onPointerStop);
    canvas.addEventListener('pointerout', onPointerStop);
    canvas.addEventListener('pointercancel', onPointerStop);

    onResize();

    // Tweakpane controls
    const diffusion = pane.addFolder({
        expanded: false,
        title: 'Diffusion Rates',
    });
    diffusion.addInput(PARAMS, 'diffusionA', { min: 0.05, max: 0.22, step: 0.01, label: 'Diffusion A' }).on('change', () => {
        rxnDiffusion.setUniform('u_diffusionA', PARAMS.diffusionA);
    });
    diffusion.addInput(PARAMS, 'diffusionB', { min: 0.05, max: 0.2, step: 0.01, label: 'Diffusion B' }).on('change', () => {
        rxnDiffusion.setUniform('u_diffusionB', PARAMS.diffusionB);
    });

    const range = pane.addFolder({
        expanded: false,
        title: 'Parameter Ranges',
    });
    range.addInput(PARAMS, 'removalRate', {
        min: 0,
        max: 0.1,
        step: 0.001,
        label: 'K',
    }).on('change', () => {
        rxnDiffusion.setUniform('u_removalRateBounds', [PARAMS.removalRate.min, PARAMS.removalRate.max]);
    });
    range.addInput(PARAMS, 'feedRate', {
        min: 0,
        max: 0.1,
        step: 0.001,
        label: 'F',
    }).on('change', () => {
        rxnDiffusion.setUniform('u_feedRateBounds', [PARAMS.feedRate.min, PARAMS.feedRate.max]);
    });

    pane.addInput(PARAMS, 'renderLayer', {
        options: {
            ['Chemical A']: 'Chemical A',
            ['Chemical B']: 'Chemical B',
        },
        label: 'Render Layer',
    });

    function dispose() {
        document.body.removeChild(canvas);
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerdown', onPointerStart);
        canvas.removeEventListener('pointerup', onPointerStop);
        canvas.removeEventListener('pointerout', onPointerStop);
        canvas.removeEventListener('pointercancel', onPointerStop);
        
        rxnDiffusion.dispose();
        renderA.dispose();
        renderB.dispose();
        touch.dispose();
        state.dispose();
        composer.dispose();
        
        pane.remove(diffusion);
        pane.remove(range);
    }

    return {
        loop,
        dispose,
        composer,
        canvas,
        updateQuality,
    };
}

function wave2dMain({ pane, contextID, glslVersion }) {
    // Create performance manager for Wave2D simulation
    const performanceManager = {
        updateQuality: (quality) => {
            // no-op in production
        }
    };
    return wave2dSimulation({ pane, contextID, glslVersion, performanceManager });
}

// 2D Wave Equation Simulation
async function wave2dSimulation({ pane, contextID, glslVersion, performanceManager }) {
    // Wait for OrbitControls to be loaded using the promise
    try {
        await window.orbitControlsLoaded;
    } catch (error) {
        console.error('Failed to load OrbitControls:', error);
        // Fallback: continue without OrbitControls (static camera)
    }
    
    // Final validation: use OrbitControls if available, otherwise fallback to static camera
    let OrbitControlsCtor = null;
    if (window.THREE && window.THREE.OrbitControls) {
        OrbitControlsCtor = window.THREE.OrbitControls;
    } else {
        console.warn('THREE.OrbitControls not available after loading; using static camera');
    }
    
    
    const {
        GPUComposer,
        GPUProgram,
        GPULayer,
        GPUIndexBuffer,
        FLOAT,
        INT,
        REPEAT,
        copyProgram,
        LINEAR,
        NEAREST,
        GLSL3,
    } = GPUIO;

    // Check for WebGL2 support
    if (glslVersion !== GLSL3) {
        console.warn('Wave2D requires WebGL2 support');
        return { dispose: () => {} };
    }

    const PARAMS = {
        separation: 50,
        c: 0.15,
        // Auto-performance parameters
        textureDim: [100, 100],
        causticsScale: 6,
        dropFrequency: 150,
        dropDiameter: 10,
    };

    // Simulation constants
    const DT = 1;
    const DX = 1;
    const DECAY = 0.005;
    const GRID_MESH_Y_SCALE = 3;
    const BACKGROUND_COLOR = [54/255, 122/255, 149/255];

    let paused = false;

    // Create canvas for Three.js
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdddddd);
    
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.zoom = 7;
    camera.position.set(7, 7, 7);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Instantiate OrbitControls if available; otherwise keep a static camera
    let controls = null;
    if (typeof OrbitControlsCtor === 'function') {
        controls = new OrbitControlsCtor(camera, canvas);
        controls.enablePan = false;
    }

    // Initialize plane for caustics
    const planeTexture = new THREE.Texture();
    const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 1.1), 
        new THREE.MeshBasicMaterial({ map: planeTexture, side: THREE.DoubleSide, transparent: true })
    );
    plane.rotateX(-Math.PI / 2);
    plane.rotateZ(-Math.PI / 2);
    plane.position.y = -PARAMS.separation / PARAMS.textureDim[0] * 0.5;
    scene.add(plane);

    // Initialize grid geometry
    const gridPositions = new Float32Array(3 * PARAMS.textureDim[0] * PARAMS.textureDim[1]);
    const gridSegmentsIndices = new Uint16Array(2 * ((PARAMS.textureDim[0] - 1) * PARAMS.textureDim[1] + (PARAMS.textureDim[1] - 1) * PARAMS.textureDim[0]));
    const gridMeshIndices = new Uint16Array(6 * (PARAMS.textureDim[0] - 1) * (PARAMS.textureDim[1] - 1));
    
    let gridSegmentIndex = 0;
    let gridMeshIndex = 0;
    
    for (let j = 0; j < PARAMS.textureDim[1]; j++) {
        for (let i = 0; i < PARAMS.textureDim[0]; i++){
            const index = PARAMS.textureDim[0] * i + j;
            gridPositions[3 * index] = (i - (PARAMS.textureDim[0] - 1) / 2) / PARAMS.textureDim[0];
            gridPositions[3 * index + 2] = (j - (PARAMS.textureDim[1] - 1) / 2) / PARAMS.textureDim[1];
            
            if (j < PARAMS.textureDim[1] - 1) {
                gridSegmentsIndices[2 * gridSegmentIndex] = index;
                gridSegmentsIndices[2 * gridSegmentIndex + 1] = index + 1;
                gridSegmentIndex += 1;
            }
            if (i < PARAMS.textureDim[0] - 1) {
                gridSegmentsIndices[2 * gridSegmentIndex] = index;
                gridSegmentsIndices[2 * gridSegmentIndex + 1] = index + PARAMS.textureDim[0];
                gridSegmentIndex += 1;
            }
            if (i < PARAMS.textureDim[0] - 1 && j < PARAMS.textureDim[1] - 1) {
                gridMeshIndices[3 * gridMeshIndex] = index;
                gridMeshIndices[3 * gridMeshIndex + 1] = index + 1;
                gridMeshIndices[3 * gridMeshIndex + 2] = index + PARAMS.textureDim[0];
                gridMeshIndex += 1;
                gridMeshIndices[3 * gridMeshIndex] = index + 1;
                gridMeshIndices[3 * gridMeshIndex + 1] = index + PARAMS.textureDim[0] + 1;
                gridMeshIndices[3 * gridMeshIndex + 2] = index + PARAMS.textureDim[0];
                gridMeshIndex += 1;
            }
        }
    }

    // Vertex shader for grid
    const vertexShader = `
        uniform sampler2D u_height;
        uniform ivec2 u_heightDimensions;

        vec2 getTextureUV(const int vertexIndex, const ivec2 dimensions) {
            int y = vertexIndex / dimensions.x;
            int x = vertexIndex - dimensions.x * y;
            float u = (float(x) + 0.5) / float(dimensions.x);
            float v = (float(y) + 0.5) / float(dimensions.y);
            return vec2(u, v);
        }

        void main() {
            vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
            vec4 position = projectionMatrix * modelViewPosition;

            vec2 uv = getTextureUV(gl_VertexID, u_heightDimensions);
            position.y += ${GRID_MESH_Y_SCALE.toFixed(6)} * texture(u_height, uv).x;

            gl_Position = position;
        }
    `;

    // Initialize grid segments
    const gridSegmentsGeometry = new THREE.BufferGeometry();
    gridSegmentsGeometry.setAttribute('position', new THREE.BufferAttribute(gridPositions, 3));
    gridSegmentsGeometry.setIndex(new THREE.BufferAttribute(gridSegmentsIndices, 1));
    
    const gridTexture = new THREE.Texture();
    const gridSegmentsMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_height: { value: gridTexture },
            u_heightDimensions: { value: PARAMS.textureDim },
        },
        vertexShader,
        fragmentShader: `
            out vec4 out_color;
            void main() {
                out_color = vec4(0, 0, 0, 1);
            }
        `,
        glslVersion: THREE.GLSL3,
    });
    
    const gridSegments = new THREE.LineSegments(gridSegmentsGeometry, gridSegmentsMaterial);
    gridSegments.position.y = PARAMS.separation / PARAMS.textureDim[0] * 0.5;
    scene.add(gridSegments);

    // Initialize grid mesh
    const gridMeshGeometry = new THREE.BufferGeometry();
    gridMeshGeometry.setAttribute('position', gridSegmentsGeometry.getAttribute('position'));
    gridMeshGeometry.setIndex(new THREE.BufferAttribute(gridMeshIndices, 1));
    
    const gridMeshMaterial = new THREE.ShaderMaterial({
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
        uniforms: {
            u_height: { value: gridTexture },
            u_heightDimensions: { value: PARAMS.textureDim },
        },
        vertexShader,
        fragmentShader: `
            out vec4 out_color;
            void main() {
                out_color = vec4(1, 1, 1, 0.7);
            }
        `,
        glslVersion: THREE.GLSL3,
        transparent: true,
    });
    
    const gridMesh = new THREE.Mesh(gridMeshGeometry, gridMeshMaterial);
    gridMesh.position.y = PARAMS.separation / PARAMS.textureDim[0] * 0.5;
    scene.add(gridMesh);

    // Initialize GPU composer
    const composer = GPUComposer.initWithThreeRenderer(renderer);
    composer.undoThreeState();

    // Initialize GPU layers
    const height = new GPULayer(composer, {
        name: 'height',
        dimensions: PARAMS.textureDim,
        numComponents: 1,
        type: FLOAT,
        filter: NEAREST,
        numBuffers: 3,
        wrapX: REPEAT,
        wrapY: REPEAT,
    });

    const heightMap = new GPULayer(composer, {
        name: 'heightMap',
        dimensions: PARAMS.textureDim,
        numComponents: 1,
        type: FLOAT,
        filter: NEAREST,
    });
    heightMap.attachToThreeTexture(gridTexture);

    const caustics = new GPULayer(composer, {
        name: 'caustics',
        dimensions: [PARAMS.textureDim[0] * PARAMS.causticsScale, PARAMS.textureDim[1] * PARAMS.causticsScale],
        numComponents: 4,
        type: FLOAT,
        filter: LINEAR,
    });
    caustics.attachToThreeTexture(planeTexture);

    const lightMeshPositions = new GPULayer(composer, {
        name: 'lightMeshPositions',
        dimensions: PARAMS.textureDim,
        numComponents: 2,
        type: FLOAT,
        filter: NEAREST,
    });

    const lightMeshIndices = new GPUIndexBuffer(composer, { indices: gridMeshIndices });

    // Initialize GPU programs
    const waveProgram = new GPUProgram(composer, {
        name: 'wave',
        fragmentShader: `
            in vec2 v_uv;

            uniform sampler2D u_height;
            uniform sampler2D u_lastHeight;
            uniform vec2 u_pxSize;
            uniform float u_alpha;

            out float out_result;

            void main() {
                float current = texture(u_height, v_uv).x;
                float last = texture(u_lastHeight, v_uv).x;
                vec2 onePxX = vec2(u_pxSize.x, 0);
                vec2 onePxY = vec2(0, u_pxSize.y);
                float n = texture(u_height, v_uv + onePxY).x;
                float s = texture(u_height, v_uv - onePxY).x;
                float e = texture(u_height, v_uv + onePxX).x;
                float w = texture(u_height, v_uv - onePxX).x;
                float laplacian = n + s + e + w - 4.0 * current;
                out_result = ${(1 - DECAY).toFixed(6)} * (u_alpha * laplacian + 2.0 * current - last);
            }
        `,
        uniforms: [
            { name: 'u_height', value: 0, type: INT },
            { name: 'u_lastHeight', value: 1, type: INT },
            { name: 'u_pxSize', value: [1 / PARAMS.textureDim[0], 1 / PARAMS.textureDim[1]], type: FLOAT },
            { name: 'u_alpha', value: (PARAMS.c * DT / DX) ** 2, type: FLOAT },
        ],
    });

    const dropProgram = new GPUProgram(composer, {
        name: 'drop',
        fragmentShader: `
            in vec2 v_uv_local;
            out float out_height;
            void main() {
                vec2 vector = v_uv_local - vec2(0.5);
                out_height = 1.0 - 2.0 * length(vector);
            }
        `,
    });

    const refractLight = new GPUProgram(composer, {
        name: 'refractLight',
        fragmentShader: `
            in vec2 v_uv;

            uniform sampler2D u_height;
            uniform vec2 u_dimensions;
            uniform float u_separation;
            uniform vec2 u_pxSize;

            out vec2 out_position;
            void main() {
                vec2 onePxX = vec2(u_pxSize.x, 0);
                vec2 onePxY = vec2(0, u_pxSize.y);
                float center = texture(u_height, v_uv).x;
                float n = texture(u_height, v_uv + onePxY).x;
                float s = texture(u_height, v_uv - onePxY).x;
                float e = texture(u_height, v_uv + onePxX).x;
                float w = texture(u_height, v_uv - onePxX).x;
                vec2 normalXY = vec2(w - e, s - n) / 2.0;
                normalXY *= min(0.0075 / length(normalXY), 1.0);
                vec3 normal = normalize(vec3(normalXY, 1.0));
                const vec3 incident = vec3(0, 0, -1);
                vec3 refractVector = refract(incident, normal, ${(1 / 1.33).toFixed(6)});
                refractVector.xy /= abs(refractVector.z);
                out_position = (0.9 * (v_uv + refractVector.xy * u_separation * 0.15) + 0.05) * u_dimensions;
            }
        `,
        uniforms: [
            { name: 'u_height', value: 0, type: INT },
            { name: 'u_pxSize', value: [1 / PARAMS.textureDim[0], 1 / PARAMS.textureDim[1]], type: FLOAT },
            { name: 'u_dimensions', value: [caustics.width, caustics.height], type: FLOAT },
            { name: 'u_separation', value: PARAMS.separation, type: FLOAT },
        ],
    });

    const computeCaustics = new GPUProgram(composer, {
        name: 'computeCaustics',
        fragmentShader: `
            in vec2 v_uv;
            in vec2 v_uv_position;

            uniform vec2 u_pxSize;

            out vec4 out_color;
            void main() {
                float oldArea = dFdx(v_uv_position.x) * dFdy(v_uv_position.y);
                float newArea = dFdx(v_uv.x) * dFdy(v_uv.y);
                float amplitude = oldArea / newArea * 0.75;
                const vec3 background = vec3(${BACKGROUND_COLOR[0]}, ${BACKGROUND_COLOR[1]}, ${BACKGROUND_COLOR[2]});
                out_color = vec4(background * amplitude, 1);
            }
        `,
    });

    const copy = copyProgram(composer, {
        name: 'copy',
        type: height.type,
        components: 'x',
    });

    // Auto-performance integration
    function updateQuality(quality) {
        const settings = QUALITY_PRESETS[quality];
        const scale = settings.particleDensity;
        
        PARAMS.textureDim = [
            Math.round(100 * scale),
            Math.round(100 * scale)
        ];
        PARAMS.causticsScale = Math.max(2, Math.round(6 * scale));
        PARAMS.dropFrequency = Math.round(150 / scale);
        
        // Resize layers and update uniforms
        height.resize(PARAMS.textureDim);
        heightMap.resize(PARAMS.textureDim);
        caustics.resize([PARAMS.textureDim[0] * PARAMS.causticsScale, PARAMS.textureDim[1] * PARAMS.causticsScale]);
        lightMeshPositions.resize(PARAMS.textureDim);
        
        // Update uniforms
        waveProgram.setUniform('u_pxSize', [1 / PARAMS.textureDim[0], 1 / PARAMS.textureDim[1]]);
        refractLight.setUniform('u_pxSize', [1 / PARAMS.textureDim[0], 1 / PARAMS.textureDim[1]]);
        refractLight.setUniform('u_dimensions', [caustics.width, caustics.height]);
        
        reset();
    }

    // Drop management
    let numFramesUntilNextDrop = PARAMS.dropFrequency;

    function addDrop() {
        const position = [
            (PARAMS.textureDim[0] - 2 * PARAMS.dropDiameter) * Math.random() + PARAMS.dropDiameter,
            (PARAMS.textureDim[1] - 2 * PARAMS.dropDiameter) * Math.random() + PARAMS.dropDiameter,
        ];
        
        height.decrementBufferIndex();
        composer.stepCircle({
            program: dropProgram,
            position,
            diameter: PARAMS.dropDiameter,
            output: height,
            useOutputScale: true,
        });
        
        height.incrementBufferIndex();
        composer.stepCircle({
            program: dropProgram,
            position,
            diameter: PARAMS.dropDiameter,
            output: height,
            useOutputScale: true,
        });
        
        numFramesUntilNextDrop = PARAMS.dropFrequency;
    }

    // Main loop
    function loop() {
        if (!paused) {
            if (--numFramesUntilNextDrop <= 0) {
                addDrop();
            }
            
            composer.step({
                program: waveProgram,
                input: [height.currentState, height.lastState],
                output: height,
            });
            
            composer.step({
                program: copy,
                input: height,
                output: heightMap,
            });
            
            composer.step({
                program: refractLight,
                input: height,
                output: lightMeshPositions,
            });
            
            caustics.clear();
            composer.drawLayerAsMesh({
                layer: lightMeshPositions,
                indices: lightMeshIndices,
                program: computeCaustics,
                output: caustics,
                useOutputScale: true,
            });
        }

        composer.resetThreeState();
        renderer.render(scene, camera);
        composer.undoThreeState();
    }

    // Event handlers
    function onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        composer.resize([width, height]);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        reset();
    }

    function reset() {
        controls.reset();
        height.clear();
        height.incrementBufferIndex();
        height.clear();
        for (let i = 0; i < 3; i++) {
            addDrop();
        }
    }

    function onKeydown(e) {
        if (e.key === ' ') {
            paused = !paused;
        }
    }

    // Event listeners
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeydown);
    onResize();

    // Tweakpane controls
    const waveGUI = pane.addFolder({
        expanded: false,
        title: 'Wave Parameters',
    });
    
    waveGUI.addInput(PARAMS, 'c', { min: 0.1, max: 0.5, step: 0.01, label: 'Wave Speed' }).on('change', () => {
        waveProgram.setUniform('u_alpha', (PARAMS.c * DT / DX) ** 2);
    });
    
    waveGUI.addInput(PARAMS, 'separation', { min: 10, max: 100, step: 1, label: 'Z Offset' }).on('change', () => {
        const val = PARAMS.separation;
        refractLight.setUniform('u_separation', val);
        plane.position.y = -val / PARAMS.textureDim[0] * 0.5;
        gridSegments.position.y = val / PARAMS.textureDim[0] * 0.5;
        gridMesh.position.y = val / PARAMS.textureDim[0] * 0.5;
    });

    const controlsGUI = pane.addFolder({
        expanded: false,
        title: 'Controls',
    });
    
    controlsGUI.addButton({ title: 'Reset' }).on('click', reset);
    controlsGUI.addButton({ title: 'Add Drop' }).on('click', addDrop);

    function dispose() {
        document.body.removeChild(canvas);
        window.removeEventListener('keydown', onKeydown);
        window.removeEventListener('resize', onResize);

        renderer.dispose();
        controls.dispose();

        plane.geometry.dispose();
        planeTexture.dispose();
        plane.material.dispose();
        gridSegments.geometry.dispose();
        gridMesh.geometry.dispose();
        gridTexture.dispose();
        gridSegments.material.dispose();
        gridMesh.material.dispose();

        height.dispose();
        heightMap.dispose();
        caustics.dispose();
        lightMeshPositions.dispose();
        lightMeshIndices.dispose();

        waveProgram.dispose();
        dropProgram.dispose();
        refractLight.dispose();
        computeCaustics.dispose();
        copy.dispose();
        
        composer.dispose();
        
        pane.remove(waveGUI);
        pane.remove(controlsGUI);
    }

    return {
        loop,
        dispose,
        composer,
        canvas,
        updateQuality,
    };
}

// ... existing code ...