const { setFloat16, getFloat16 } = float16;

const {
	HALF_FLOAT,
	FLOAT,
	UNSIGNED_BYTE,
	BYTE,
	UNSIGNED_SHORT,
	SHORT,
	UNSIGNED_INT,
	INT,
	GLSL3,
	WEBGL2,
	LINEAR,
	NEAREST,
	REPEAT,
	CLAMP_TO_EDGE,
	getVertexShaderMediumpPrecision,
	getFragmentShaderMediumpPrecision,
	isHighpSupportedInVertexShader,
	isHighpSupportedInFragmentShader
} = GPUIO;

MicroModal.init();

const browserReport = browserReportSync();
const browser = `${browserReport.browser.name} ${browserReport.browser.version ? `v${browserReport.browser.version}` : 'unknown version'}`;
const os = `${browserReport.os.name} ${browserReport.os.version ? `v${browserReport.os.version}` : 'unknown version'}`;

document.getElementById('info').innerHTML =  `
Browser: ${browser}<br/>
Operating System: ${os}<br/>
<br/>
WebGL2 Supported: ${isWebGL2Supported()}<br/>
Vertex shader mediump precision handled as: ${getVertexShaderMediumpPrecision()}<br/>
Fragment shader mediump precision handled as: ${getFragmentShaderMediumpPrecision()}<br/>
Vertex shader supports highp precision: ${isHighpSupportedInVertexShader()}<br/>
Fragment shader supports highp precision: ${isHighpSupportedInFragmentShader()}<br/>
<br/>
Click on the test to see more info.<br/>
<br/>
All tests are performed on non-power of 2 textures.<br/>
In cases where INT types are not available, FLOAT types are used instead, but may be limited in the range of int values they can represent.<br/>
"default" is NEAREST filtering with CLAMP_TO_EDGE wrapping.<br/>
* indicates that fragment shader polyfill was used.<br/>
Extrema (min, max, min magnitude, max magnitude) for each type are tested.<br/>
<br/>
<a href="#" id="saveImage">Save results as PNG</a>`;

document.getElementById('saveImage').addEventListener('click', (e) => {
	e.preventDefault();
	domtoimage.toPng(document.getElementById('output'))
		.then(function (dataUrl) {
			const link = document.createElement('a');
			link.download = `${document.getElementById('testTitle').innerHTML}_${browser}_${os}.png`.replace(/\s+/g, '_');
			link.href = dataUrl;
			link.click();
		});
});

function addModal() {
	const modalHTML = `<div class="modal micromodal-slide" id="modal-1" aria-hidden="true">
		<div class="modal__overlay" tabindex="-1" data-micromodal-close>
			<div id="modal-1-container" class="modal__container" role="dialog" aria-modal="true" aria-labelledby="modal-1-title">
				<header class="modal__header">
					<h2 class="modal__title" id="modal-1-title">
					</h2>
					<button class="modal__close" aria-label="Close modal" data-micromodal-close></button>
				</header>
				<main class="modal__content" id="modal-1-content">
					<p id="modal-1-config"></p>
					<p id="modal-1-error"></p>
				</main>
			</div>
		</div>
	</div>`;
	const div = document.createElement('div');
	div.innerHTML = modalHTML;
	document.getElementsByTagName('body')[0].appendChild(div.children[0]);
}
addModal();

function showMoreInfo(e, result) {
	e.preventDefault();
	const modal = document.getElementById('modal-1-container');
	modal.className = `${result.status} modal__container`;
	document.getElementById('modal-1-title').innerHTML = result.status;
	document.getElementById('modal-1-error').innerHTML =
		`${(result.log ? result.log : []).concat((result.polyfill ? result.polyfill : []).concat(result.error)).join('<br/><br/>')}`;
	document.getElementById('modal-1-config').innerHTML = Object.keys(result.config).map(key => `${key}: ${result.config[key]}`).join('<br/>');
	MicroModal.show('modal-1');
}

function makeTitleColumn(titles, title) {
	const container = document.createElement('div');
	container.className = 'column-title';
	if (title) {
		const titleDiv = document.createElement('div');
		titleDiv.className = 'entry';
		titleDiv.innerHTML = title;
		container.appendChild(titleDiv);
	}
	titles.forEach(title => {
		const titleDiv = document.createElement('div');
		titleDiv.className = 'entry';
		titleDiv.innerHTML = title;
		container.appendChild(titleDiv);
	});
	return container;
}

function makeColumn(results, extremaResults, title) {
	const container = document.createElement('div');
	container.className = 'column';
	const titleDiv = document.createElement('div');
	titleDiv.className = 'entry header';
	titleDiv.innerHTML = title;
	container.appendChild(titleDiv);
	results.forEach((result, index) => {
		if (result.status !== NA) {
			// Merge in extrema result.
			const extremaResult = extremaResults[index];
			if (extremaResult.extremaError) result.error.push(...extremaResult.extremaError);
			if (extremaResult.extremaWarning) result.error.push(...extremaResult.extremaWarning);
			if (extremaResult.status === ERROR) {
				result.status = ERROR;
			} else if (extremaResult.status === WARNING && result.status !== ERROR) {
				result.status = WARNING;
			}
		}

		const element = document.createElement('div');
		element.className = `entry result ${result.status}`;
		if (result.status === SUCCESS) {
			element.innerHTML = `&#10003;${result.polyfill.length ? '*' : ''}`;
		} else if (result.status === NA) {
			element.innerHTML = 'NA';
		} else if (result.status === WARNING) {
			element.innerHTML = `!${result.polyfill.length ? '*' : ''}`;
		} else if (result.status === ERROR) {
			element.innerHTML = 'X';
		}
		const link = document.createElement('a');
		link.href = '#';
		link.onclick = (e) => showMoreInfo(e, result);
		link.appendChild(element);
		container.appendChild(link);
	});
	return container;
}

function isWebGL2Supported() {
	const gl = document.createElement('canvas').getContext(WEBGL2);
	if (!gl) {
		return false;
	}
	return true;
}

function makeTable(testFunction) {

	let tests;
    if (GPUIO.isWebGL2Supported()) {
      tests = [
        { WEBGL_VERSION: GPUIO.WEBGL2, GLSL_VERSION: GPUIO.GLSL3 },
        { WEBGL_VERSION: GPUIO.WEBGL2, GLSL_VERSION: GPUIO.GLSL1 },
        { WEBGL_VERSION: GPUIO.WEBGL1, GLSL_VERSION: GPUIO.GLSL1 },
      ];
    } else {
      tests = [
        { WEBGL_VERSION: GPUIO.WEBGL1, GLSL_VERSION: GPUIO.GLSL1 },
      ];
    }

	// To make things simpler, keep DIM_X * DIMY < 256.
	const DIM_X = 30;
	const DIM_Y = 30;

	const output = document.getElementById('output');

	const types = [
		HALF_FLOAT,
		FLOAT,
		UNSIGNED_BYTE,
		BYTE,
		UNSIGNED_SHORT,
		SHORT,
		UNSIGNED_INT,
		INT,
	];
	types.forEach((TYPE) => {
		// Create place to show results.
		const div = document.createElement('div');
		output.appendChild(div);

		// Make vertical label displaying type.
		const label = document.createElement('div');
		label.className = 'label';
		const labelInner = document.createElement('div');
		labelInner.className = 'rotate bold';
		labelInner.innerHTML = TYPE;
		label.appendChild(labelInner);
		div.appendChild(label);

		// Container for table.
		const container = document.createElement('div');
		container.className = 'container';
		div.appendChild(container);

		const rowTitles = ['R', 'RG', 'RGB', 'RGBA'];
		container.appendChild(makeTitleColumn(rowTitles));

		// Loop through each glsl version.
		tests.forEach(({ GLSL_VERSION, WEBGL_VERSION }) => {
			const outerTable = document.createElement('div');
			outerTable.className="outerTable"
			container.appendChild(outerTable);
			const outerTableTitle = document.createElement('div');
			outerTableTitle.className="outerTable-title entry"
			outerTableTitle.innerHTML = `WebGL ${WEBGL_VERSION === WEBGL2 ? '2' : '1'} + GLSL v${GLSL_VERSION === GLSL3 ? '3' : '1'}`;
			outerTable.appendChild(outerTableTitle);

			// Loop through various settings.
			const extremaResults = [];
			for (let NUM_ELEMENTS = 1; NUM_ELEMENTS <= 4; NUM_ELEMENTS++) {
				// Test array writes for type.
				extremaResults.push(testFunction({
					TYPE,
					DIM_X,
					DIM_Y,
					NUM_ELEMENTS,
					WEBGL_VERSION,
					GLSL_VERSION,
					WRAP: CLAMP_TO_EDGE,
					FILTER: NEAREST,
					TEST_EXTREMA: true,
				}));
			}

			const defaultResults = [];
			for (let NUM_ELEMENTS = 1; NUM_ELEMENTS <= 4; NUM_ELEMENTS++) {
				// Test array writes for type.
				defaultResults.push(testFunction({
					TYPE,
					DIM_X,
					DIM_Y,
					NUM_ELEMENTS,
					WEBGL_VERSION,
					GLSL_VERSION,
					WRAP: CLAMP_TO_EDGE,
					FILTER: NEAREST,
				}));
			}
			outerTable.appendChild(makeColumn(defaultResults, extremaResults, '<br/>default'));

			const linearResults = [];
			for (let NUM_ELEMENTS = 1; NUM_ELEMENTS <= 4; NUM_ELEMENTS++) {
				// Test array writes for type.
				linearResults.push(testFunction({
					TYPE,
					DIM_X,
					DIM_Y,
					NUM_ELEMENTS,
					WEBGL_VERSION,
					GLSL_VERSION,
					WRAP: CLAMP_TO_EDGE,
					FILTER: LINEAR,
				}));
			}
			outerTable.appendChild(makeColumn(linearResults, extremaResults, 'filter<br/>LINEAR'));

			const repeatResults = [];
			for (let NUM_ELEMENTS = 1; NUM_ELEMENTS <= 4; NUM_ELEMENTS++) {
				// Test array writes for type.
				repeatResults.push(testFunction({
					TYPE,
					DIM_X,
					DIM_Y,
					NUM_ELEMENTS,
					WEBGL_VERSION,
					GLSL_VERSION,
					WRAP: REPEAT,
					FILTER: NEAREST,
				}));
			}
			outerTable.appendChild(makeColumn(repeatResults, extremaResults, 'wrap<br/>REPEAT'));

			const linearRepeatResults = [];
			for (let NUM_ELEMENTS = 1; NUM_ELEMENTS <= 4; NUM_ELEMENTS++) {
				// Test array writes for type.
				linearRepeatResults.push(testFunction({
					TYPE,
					DIM_X,
					DIM_Y,
					NUM_ELEMENTS,
					WEBGL_VERSION,
					GLSL_VERSION,
					WRAP: REPEAT,
					FILTER: LINEAR,
				}));
			}
			outerTable.appendChild(makeColumn(linearRepeatResults, extremaResults, 'LINEAR<br/>REPEAT'));
		});

		container.appendChild(document.createElement('br'));
	});
}

// Performance testing functionality
function addPerformanceTests() {
	const performanceSection = document.createElement('div');
	performanceSection.id = 'performance-tests';
	performanceSection.innerHTML = `
		<h2>Performance Auto-Profile Tests</h2>
		<div id="performance-info">
			<p>Testing fluid background performance with different quality presets...</p>
			<div id="performance-controls">
				<button id="run-performance-test">Run Performance Test</button>
				<button id="run-throttled-test">Run Throttled Test</button>
				<select id="preset-selector">
					<option value="auto">Auto-detect</option>
					<option value="high">High (High)</option>
					<option value="medium">Medium (Medium)</option>
					<option value="low">Low (Low)</option>
					<option value="minimal">Minimal (Minimal)</option>
				</select>
			</div>
			<div id="performance-results"></div>
		</div>
	`;
	document.getElementById('output').appendChild(performanceSection);

	// Performance test implementation
	let currentTest = null;
	let frameCount = 0;
	let startTime = 0;
	let throttleActive = false;

	// Synthetic throttling using requestAnimationFrame wrapper
	function createThrottledRAF(throttleFactor = 0.5) {
		let lastFrame = 0;
		return function(callback) {
			const now = performance.now();
			const elapsed = now - lastFrame;
			const targetInterval = (1000 / 60) / throttleFactor; // Slow down frame rate
			
			if (elapsed >= targetInterval) {
				lastFrame = now;
				return requestAnimationFrame(callback);
			} else {
				return setTimeout(() => requestAnimationFrame(callback), targetInterval - elapsed);
			}
		};
	}

	function runPerformanceTest(presetId = 'auto', useThrottling = false) {
		const resultsDiv = document.getElementById('performance-results');
		resultsDiv.innerHTML = '<p>Running performance test...</p>';

		try {
			// Clean up previous test
			if (currentTest) {
				currentTest.dispose();
			}

			// Create test canvas
			const canvas = document.createElement('canvas');
			canvas.width = 800;
			canvas.height = 600;
			canvas.style.border = '1px solid #ccc';
			canvas.style.display = 'block';
			canvas.style.margin = '10px 0';

			// Performance metrics collection
			const metrics = {
				frames: [],
				avgFPS: 0,
				minFPS: Infinity,
				maxFPS: 0,
				preset: presetId,
				throttled: useThrottling
			};

			// Setup performance monitoring
			let animationId;
			frameCount = 0;
			startTime = performance.now();

			const originalRAF = window.requestAnimationFrame;
			if (useThrottling) {
				window.requestAnimationFrame = createThrottledRAF(0.3); // Heavy throttling
			}

			// Create fluid background with performance monitoring
			const options = {
				targetFPS: 60,
				debugLogging: true,
				onPerformanceUpdate: (perfMetrics) => {
					metrics.frames.push({
						fps: perfMetrics.fps,
						timestamp: perfMetrics.timestamp,
						numTicks: perfMetrics.numTicks
					});
				}
			};

			if (presetId !== 'auto') {
				options.profileId = presetId;
			}

			// Use GPUIO performance module
			if (GPUIO.performance && GPUIO.performance.createFluidBackground) {
				currentTest = GPUIO.performance.createFluidBackground(GPUIO, options);
			} else {
				// Fallback: create basic GPUComposer for testing
				currentTest = new GPUIO.GPUComposer({ 
					canvas,
					autoPerformanceProfile: options
				});
			}

			// Animation loop for metrics collection
			function animate() {
				frameCount++;
				const now = performance.now();
				const elapsed = now - startTime;

				if (elapsed >= 1000) { // Collect data for 1 second intervals
					const fps = (frameCount * 1000) / elapsed;
					metrics.avgFPS = (metrics.avgFPS + fps) / 2;
					metrics.minFPS = Math.min(metrics.minFPS, fps);
					metrics.maxFPS = Math.max(metrics.maxFPS, fps);
					
					frameCount = 0;
					startTime = now;
				}

				// Run test for 5 seconds
				if (now - startTime < 5000) {
					animationId = requestAnimationFrame(animate);
				} else {
					// Test complete
					window.requestAnimationFrame = originalRAF; // Restore original RAF
					
					// Display results
					const currentPreset = currentTest.getCurrentQualityPreset ? 
						currentTest.getCurrentQualityPreset() : 
						{ id: presetId };
					
					resultsDiv.innerHTML = `
						<h3>Performance Test Results</h3>
						<p><strong>Preset:</strong> ${currentPreset ? currentPreset.id : 'Unknown'}</p>
						<p><strong>Throttled:</strong> ${useThrottling ? 'Yes' : 'No'}</p>
						<p><strong>Average FPS:</strong> ${metrics.avgFPS.toFixed(2)}</p>
						<p><strong>Min FPS:</strong> ${metrics.minFPS.toFixed(2)}</p>
						<p><strong>Max FPS:</strong> ${metrics.maxFPS.toFixed(2)}</p>
						<p><strong>Frame Samples:</strong> ${metrics.frames.length}</p>
						<canvas id="performance-chart" width="400" height="200" style="border: 1px solid #ddd;"></canvas>
					`;

					// Draw simple FPS chart
					drawFPSChart(metrics.frames);
				}
			}

			animate();

		} catch (error) {
			resultsDiv.innerHTML = `<p style="color: red;">Error running performance test: ${error.message}</p>`;
			console.error('Performance test error:', error);
		}
	}

	function drawFPSChart(frames) {
		const canvas = document.getElementById('performance-chart');
		if (!canvas || frames.length === 0) return;

		const ctx = canvas.getContext('2d');
		const width = canvas.width;
		const height = canvas.height;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		// Find FPS range
		const fpsList = frames.map(f => f.fps);
		const minFPS = Math.min(...fpsList);
		const maxFPS = Math.max(...fpsList);
		const fpsRange = maxFPS - minFPS || 1;

		// Draw FPS line
		ctx.strokeStyle = '#007acc';
		ctx.lineWidth = 2;
		ctx.beginPath();

		frames.forEach((frame, index) => {
			const x = (index / (frames.length - 1)) * width;
			const y = height - ((frame.fps - minFPS) / fpsRange) * height;
			
			if (index === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});

		ctx.stroke();

		// Draw labels
		ctx.fillStyle = '#333';
		ctx.font = '12px Arial';
		ctx.fillText(`Max: ${maxFPS.toFixed(1)} FPS`, 10, 20);
		ctx.fillText(`Min: ${minFPS.toFixed(1)} FPS`, 10, height - 10);
	}

	// Event listeners
	document.getElementById('run-performance-test').addEventListener('click', () => {
		const preset = document.getElementById('preset-selector').value;
		runPerformanceTest(preset, false);
	});

	document.getElementById('run-throttled-test').addEventListener('click', () => {
		const preset = document.getElementById('preset-selector').value;
		runPerformanceTest(preset, true);
	});
}

// Add performance tests to the page
if (GPUIO.performance) {
	addPerformanceTests();
}

const pending = document.getElementsByClassName('pending');

for (const el of pending) {
	el.innerHTML = '';
}
