// Main is called from ../common/wrapper.js
function main({ pane, contextID, glslVersion}) {
	const {
		GPUComposer,
		GPUProgram,
		GPULayer,
		SHORT,
		INT,
		FLOAT,
		REPEAT,
		NEAREST,
		LINEAR,
		renderSignedAmplitudeProgram,
		performance: { QUALITY_PRESETS, QUALITY_SEQUENCE, getNextQualityId, detectQualityProfile }
	} = GPUIO;

	// UI Parameters
	const PARAMS = {
		autoTuning: true,
		manualQuality: 'high',
		render: 'Fluid',
		showFPS: true,
		showQualityInfo: true,
	};

	// Current quality settings (will be updated by auto-tuning or manual selection)
	let currentQuality = 'high';
	let currentPreset = QUALITY_PRESETS[currentQuality];

	// Performance tracking
	let frameCount = 0;
	let lastTime = performance.now();
	let fps = 60;
	let fpsHistory = [];
	const FPS_HISTORY_LENGTH = 60; // Track last 60 frames

	let shouldSavePNG = false;

	const canvas = document.createElement('canvas');
	document.body.appendChild(canvas);

	// Create FPS display
	const fpsDisplay = document.createElement('div');
	fpsDisplay.style.position = 'absolute';
	fpsDisplay.style.top = '10px';
	fpsDisplay.style.left = '10px';
	fpsDisplay.style.color = 'white';
	fpsDisplay.style.fontFamily = 'monospace';
	fpsDisplay.style.fontSize = '14px';
	fpsDisplay.style.background = 'rgba(0,0,0,0.7)';
	fpsDisplay.style.padding = '8px';
	fpsDisplay.style.borderRadius = '4px';
	fpsDisplay.style.zIndex = '1000';
	document.body.appendChild(fpsDisplay);

	function updateFPS() {
		const now = performance.now();
		const delta = now - lastTime;
		lastTime = now;
		
		if (delta > 0) {
			const currentFPS = 1000 / delta;
			fpsHistory.push(currentFPS);
			if (fpsHistory.length > FPS_HISTORY_LENGTH) {
				fpsHistory.shift();
			}
			
			// Calculate average FPS
			fps = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;
		}
		
		frameCount++;
		
		if (PARAMS.showFPS) {
			const qualityInfo = PARAMS.showQualityInfo ? 
				`\nQuality: ${currentQuality.toUpperCase()}\nParticles: ${Math.floor(currentPreset.maxParticles * currentPreset.particleDensity)}\nAuto-tuning: ${PARAMS.autoTuning ? 'ON' : 'OFF'}` : '';
			fpsDisplay.textContent = `FPS: ${fps.toFixed(1)}${qualityInfo}`;
			fpsDisplay.style.display = 'block';
		} else {
			fpsDisplay.style.display = 'none';
		}
	}

	function calcNumParticles(width, height) {
		return Math.min(Math.ceil(width * height * currentPreset.particleDensity), currentPreset.maxParticles);
	}

	function updateQualitySettings(newQuality) {
		if (newQuality === currentQuality) return;
		
		console.log(`Switching quality from ${currentQuality} to ${newQuality}`);
		currentQuality = newQuality;
		currentPreset = QUALITY_PRESETS[currentQuality];
		
		// Update particle count
		NUM_PARTICLES = calcNumParticles(canvas.width, canvas.height);
		
		// Reinitialize particle layers with new dimensions
		if (particlePositionState) {
			particlePositionState.resize(NUM_PARTICLES);
		}
		if (particleInitialState) {
			particleInitialState.resize(NUM_PARTICLES);
		}
		if (particleAgeState) {
			particleAgeState.resize(NUM_PARTICLES);
		}
		
		// Reset particles
		initParticlePositions();
		initParticleAge();
	}

	// Auto-tuning logic
	function checkPerformanceAndAdjust() {
		if (!PARAMS.autoTuning) return;
		
		if (fpsHistory.length < FPS_HISTORY_LENGTH) return; // Wait for enough data
		
		const avgFPS = fps;
		const targetFPS = currentPreset.frameBudget;
		
		// If FPS is consistently below target, downgrade quality
		if (avgFPS < targetFPS - 5) {
			const nextQuality = getNextQualityId(currentQuality, 'down');
			if (nextQuality) {
				updateQualitySettings(nextQuality);
			}
		}
		// If FPS is consistently above target + buffer, upgrade quality
		else if (avgFPS > targetFPS + 10) {
			const nextQuality = getNextQualityId(currentQuality, 'up');
			if (nextQuality) {
				updateQualitySettings(nextQuality);
			}
		}
	}

	let NUM_PARTICLES = calcNumParticles(canvas.width, canvas.height);

	const composer = new GPUComposer({ 
		canvas, 
		contextID, 
		glslVersion,
		// Enable auto-performance tuning
		autoPerformance: PARAMS.autoTuning ? {
			targetFPS: 60,
			debugLogging: true,
			onRequestDowngrade: (targetProfileId) => {
				if (PARAMS.autoTuning) {
					updateQualitySettings(targetProfileId);
				}
			}
		} : undefined
	});

	// Init state.
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const velocityState = new GPULayer(composer, {
		name: 'velocity',
		dimensions: [Math.ceil(width / currentPreset.velocityScaleFactor), Math.ceil(height / currentPreset.velocityScaleFactor)],
		type: FLOAT,
		filter: LINEAR,
		numComponents: 2,
		wrapX: REPEAT,
		wrapY: REPEAT,
		numBuffers: 2,
	});
	const divergenceState = new GPULayer(composer, {
		name: 'divergence',
		dimensions: [velocityState.width, velocityState.height],
		type: FLOAT,
		filter: NEAREST,
		numComponents: 1,
		wrapX: REPEAT,
		wrapY: REPEAT,
	});
	const pressureState = new GPULayer(composer, {
		name: 'pressure',
		dimensions: [velocityState.width, velocityState.height],
		type: FLOAT,
		filter: NEAREST,
		numComponents: 1,
		wrapX: REPEAT,
		wrapY: REPEAT,
		numBuffers: 2,
	});
	const particlePositionState = new GPULayer(composer, {
		name: 'position',
		dimensions: NUM_PARTICLES,
		type: FLOAT,
		numComponents: 4, // POSITION_NUM_COMPONENTS
		numBuffers: 2,
	});
	// We can use the initial state to reset particles after they've died.
	const particleInitialState = new GPULayer(composer, {
		name: 'initialPosition',
		dimensions: NUM_PARTICLES,
		type: FLOAT,
		numComponents: 4, // POSITION_NUM_COMPONENTS
		numBuffers: 1,
	});
	const particleAgeState = new GPULayer(composer, {
		name: 'age',
		dimensions: NUM_PARTICLES,
		type: SHORT,
		numComponents: 1,
		numBuffers: 2,
	});
	const trailState = new GPULayer(composer, {
		name: 'trails',
		dimensions: [width, height],
		type: FLOAT,
		filter: NEAREST,
		numComponents: 1,
		numBuffers: 2,
	});

	function initParticlePositions() {
		const positions = new Float32Array(NUM_PARTICLES * 4);
		for (let i = 0; i < NUM_PARTICLES; i++) {
			positions[4 * i] = Math.random() * width;
			positions[4 * i + 1] = Math.random() * height;
			positions[4 * i + 2] = 0;
			positions[4 * i + 3] = 0;
		}
		particlePositionState.loadData(positions);
		particleInitialState.loadData(positions);
	}

	function initParticleAge() {
		const ages = new Int16Array(NUM_PARTICLES);
		for (let i = 0; i < NUM_PARTICLES; i++) {
			ages[i] = Math.round(Math.random() * currentPreset.particleLifetime);
		}
		particleAgeState.loadData(ages);
	}

	// Initialize particles
	initParticlePositions();
	initParticleAge();

	// Programs (simplified versions for demo)
	const advectProgram = new GPUProgram(composer, {
		name: 'advect',
		fragmentShader: `
			in vec2 v_uv;
			uniform sampler2D u_state;
			uniform sampler2D u_velocity;
			uniform vec2 u_dimensions;
			uniform float u_dt;
			out vec2 out_state;
			void main() {
				vec2 velocity = texture(u_velocity, v_uv).xy;
				vec2 prevUV = v_uv - velocity * u_dt / u_dimensions;
				out_state = texture(u_state, prevUV).xy;
			}
		`,
		uniforms: [
			{ name: 'u_state', value: 0, type: INT },
			{ name: 'u_velocity', value: 1, type: INT },
			{ name: 'u_dimensions', value: [velocityState.width, velocityState.height], type: FLOAT },
			{ name: 'u_dt', value: 1, type: FLOAT },
		],
	});

	const renderProgram = new GPUProgram(composer, {
		name: 'render',
		fragmentShader: `
			in vec2 v_uv;
			uniform sampler2D u_trails;
			out vec4 out_color;
			void main() {
				float trail = texture(u_trails, v_uv).x;
				vec3 color = vec3(0.1, 0.4, 0.8) * trail;
				out_color = vec4(color, 1.0);
			}
		`,
		uniforms: [
			{ name: 'u_trails', value: 0, type: INT },
		],
	});

	// Touch/mouse interaction
	let mouseX = 0, mouseY = 0;
	let prevMouseX = 0, prevMouseY = 0;
	let mouseIsDown = false;

	function onMouseMove(e) {
		prevMouseX = mouseX;
		prevMouseY = mouseY;
		mouseX = e.clientX;
		mouseY = e.clientY;
	}

	function onMouseDown() {
		mouseIsDown = true;
	}

	function onMouseUp() {
		mouseIsDown = false;
	}

	canvas.addEventListener('mousemove', onMouseMove);
	canvas.addEventListener('mousedown', onMouseDown);
	canvas.addEventListener('mouseup', onMouseUp);
	canvas.addEventListener('touchmove', (e) => {
		e.preventDefault();
		const touch = e.touches[0];
		onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
	});
	canvas.addEventListener('touchstart', (e) => {
		e.preventDefault();
		onMouseDown();
	});
	canvas.addEventListener('touchend', (e) => {
		e.preventDefault();
		onMouseUp();
	});

	// UI Controls
	const autoTuningFolder = pane.addFolder({ title: 'Performance Tuning' });
	
	autoTuningFolder.addInput(PARAMS, 'autoTuning', { label: 'Auto-Tuning' }).on('change', (e) => {
		if (e.value) {
			// Re-enable auto-tuning
			composer.setAutoPerformance({
				targetFPS: 60,
				debugLogging: true,
				onRequestDowngrade: (targetProfileId) => {
					updateQualitySettings(targetProfileId);
				}
			});
		} else {
			// Disable auto-tuning
			composer.setAutoPerformance(undefined);
		}
	});

	autoTuningFolder.addInput(PARAMS, 'manualQuality', { 
		label: 'Manual Quality',
		options: {
			'High (High)': 'high',
			'Medium (Medium)': 'medium', 
			'Low (Low)': 'low',
			'Minimal (Minimal)': 'minimal'
		}
	}).on('change', (e) => {
		if (!PARAMS.autoTuning) {
			updateQualitySettings(e.value);
		}
	});

	const displayFolder = pane.addFolder({ title: 'Display Options' });
	displayFolder.addInput(PARAMS, 'showFPS', { label: 'Show FPS' });
	displayFolder.addInput(PARAMS, 'showQualityInfo', { label: 'Show Quality Info' });
	displayFolder.addInput(PARAMS, 'render', { 
		label: 'Render Mode',
		options: {
			'Fluid': 'Fluid',
			'Velocity': 'Velocity',
			'Pressure': 'Pressure'
		}
	});

	// Quality info display
	const qualityFolder = pane.addFolder({ title: 'Current Quality Settings' });
	const qualityMonitor = qualityFolder.addMonitor(currentPreset, 'particleDensity', { label: 'Particle Density' });
	const particleMonitor = qualityFolder.addMonitor(currentPreset, 'maxParticles', { label: 'Max Particles' });
	const jacobiMonitor = qualityFolder.addMonitor(currentPreset, 'numJacobiSteps', { label: 'Jacobi Steps' });
	const renderStepsMonitor = qualityFolder.addMonitor(currentPreset, 'numRenderSteps', { label: 'Render Steps' });

	function updateQualityMonitors() {
		qualityMonitor.refresh();
		particleMonitor.refresh();
		jacobiMonitor.refresh();
		renderStepsMonitor.refresh();
	}

	// Animation loop
	function animate() {
		updateFPS();
		
		// Check performance and adjust quality every 60 frames
		if (frameCount % 60 === 0) {
			checkPerformanceAndAdjust();
			updateQualityMonitors();
		}

		// Simple fluid simulation (simplified for demo)
		composer.step({
			program: advectProgram,
			input: [velocityState, velocityState],
			output: velocityState,
		});

		// Render
		composer.step({
			program: renderProgram,
			input: trailState,
			output: canvas,
		});

		if (shouldSavePNG) {
			composer.savePNG({ filename: `auto-performance-${currentQuality}` });
			shouldSavePNG = false;
		}

		requestAnimationFrame(animate);
	}

	// Start animation
	animate();

	// Keyboard shortcuts
	document.addEventListener('keydown', (e) => {
		if (e.key === 'v') {
			shouldSavePNG = true;
		}
		// Quality shortcuts
		if (e.key === '1') updateQualitySettings('high');
		if (e.key === '2') updateQualitySettings('medium');
		if (e.key === '3') updateQualitySettings('low');
		if (e.key === '4') updateQualitySettings('minimal');
		// Toggle auto-tuning
		if (e.key === 'a') {
			PARAMS.autoTuning = !PARAMS.autoTuning;
			pane.refresh();
		}
	});

	// Cleanup
	return () => {
		document.body.removeChild(fpsDisplay);
		canvas.removeEventListener('mousemove', onMouseMove);
		canvas.removeEventListener('mousedown', onMouseDown);
		canvas.removeEventListener('mouseup', onMouseUp);
	};
}