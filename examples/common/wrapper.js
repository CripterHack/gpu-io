'use strict';
{
	const {
		GLSL1,
		GLSL3,
		WEBGL1,
		WEBGL2,
		isWebGL2Supported,
	} = GPUIO;

	// https://github.com/amandaghassaei/canvas-capture
	const CanvasCapture = window.CanvasCapture ? window.CanvasCapture.CanvasCapture : null;
	const RECORD_FPS = 60;

	// Init a simple gui.
	const guiContainer = document.createElement('div');
	guiContainer.id = 'gui-container';
	guiContainer.style.position = 'fixed';
	guiContainer.style.top = '0';
	guiContainer.style.right = '0';
	guiContainer.style.zIndex = 1001;
	guiContainer.style.pointerEvents = 'auto';
	document.body.appendChild(guiContainer);
	const pane = new Tweakpane.Pane({ container: guiContainer });
	pane.expanded = true; // Ensure the main pane is expanded by default
	// Init a pane to toggle main mane visibility.
	const toggleContainer = document.createElement('div');
	toggleContainer.id = 'pane-toggle-container';
	toggleContainer.style.position = 'fixed';
	toggleContainer.style.top = '10px';
	toggleContainer.style.left = '10px';
	toggleContainer.style.zIndex = 1002;
	document.body.appendChild(toggleContainer);
	const paneToggle = new Tweakpane.Pane({ container: toggleContainer });
	paneToggle.expanded = false;
	paneToggle.addButton({ title: 'Show Controls' }).on('click', () => {
		paneToggle.expanded = false;
		pane.expanded = true;
	});
	pane.addButton({ title: 'Hide Controls'}).on('click', () => {
		pane.expanded = false;
		paneToggle.expanded = true;
	});

	// Init info dialog.
	MicroModal.init();

	// Init an overlay to prevent click events from bubbling through
	// modal to gui or canvas.
	// Show/hide overlay when modal is opened/closed.
	const overlay = document.createElement('div');
	overlay.id = 'touchOverlay';
	overlay.style.width = '100%';
	overlay.style.height = '100%'
	overlay.style.opacity = 0;
	overlay.style.position = 'absolute';
	overlay.style['z-index'] = 1;
	overlay.style.display = 'none';
	document.body.append(overlay);

	const webGLSettings = {
		webGLVersion: isWebGL2Supported() ? 'WebGL 2' : 'WebGL 1',
		GLSLVersion: isWebGL2Supported() ? 'GLSL 3' : 'GLSL 1',
	};
	const availableWebGLVersions = { webgl1: 'WebGL 1' };
	const availableGLSLVersions = { glsl1: 'GLSL 1' };
	if (isWebGL2Supported()) {
		availableWebGLVersions.webgl2 = 'WebGL 2';
		availableGLSLVersions.glsl3 = 'GLSL 3';
	}
	
	// Global variables to get from example app.
	let loop, dispose, composer, canvas;
	// Other global ui variables.
	let title = webGLSettings.webGLVersion;
	let useGLSL3Toggle;

	function reloadExampleWithNewParams() {
		// Stop any existing animation loop first
		if (window.currentAnimationId) {
			cancelAnimationFrame(window.currentAnimationId);
			window.currentAnimationId = null;
		}
		
		if (useGLSL3Toggle) {
			useGLSL3Toggle.dispose();
			useGLSL3Toggle = undefined;
		}
		if (webGLSettings.webGLVersion === 'WebGL 1') webGLSettings.GLSLVersion = 'GLSL 1';
		
		// Clear existing references before disposal
		const oldLoop = loop;
		const oldComposer = composer;
		loop = null;
		composer = null;
		
		if (dispose) {
			try {
				dispose();
			} catch (error) {
				console.warn('Error during disposal:', error);
			}
			dispose = null;
		}
		
		// Wait a frame to ensure disposal is complete
		requestAnimationFrame(() => {
			// Handle async main function
			const result = main({
				pane,
				contextID: webGLSettings.webGLVersion === 'WebGL 2' ? WEBGL2 : WEBGL1,
				glslVersion: webGLSettings.GLSLVersion === 'GLSL 3' ? GLSL3 : GLSL1,
			});
			
			// If main returns a promise, handle it
			if (result instanceof Promise) {
				result.then((resolvedResult) => {
					if (resolvedResult) {
						if (window.applyExampleResult) {
							window.applyExampleResult(resolvedResult);
						} else {
							({ loop, composer, dispose, canvas } = resolvedResult);
							if (canvas) {
								canvas.addEventListener('gesturestart', disableZoom);
								canvas.addEventListener('gesturechange', disableZoom); 
								canvas.addEventListener('gestureend', disableZoom);
							}
						}
					}
				}).catch((error) => {
					console.error('Error loading example:', error);
				});
			} else {
				// Synchronous result
				if (window.applyExampleResult) {
					window.applyExampleResult(result);
				} else {
					({ loop, composer, dispose, canvas } = result);
					if (canvas) {
						canvas.addEventListener('gesturestart', disableZoom);
						canvas.addEventListener('gesturechange', disableZoom);
						canvas.addEventListener('gestureend', disableZoom);
					}
				}
			}
		});
		
		useGLSL3Toggle = settings.addInput(
			webGLSettings,
			'GLSLVersion',
			{
				options: webGLSettings.webGLVersion === 'WebGL 2' ? availableGLSLVersions : { glsl1: 'GLSL 1' },
				label: 'GLSL Version',
			}).on('change', () => {
				// Some weird issue with calling dispose() inside change callback is throwing error in Tweakpane.
				// Use timeout to fix it.
				setTimeout(reloadExampleWithNewParams, 10);
			});
		title = `${webGLSettings.webGLVersion}`;
		settings.title = title;

		// Initialize recording only when a valid canvas is available
		if (CanvasCapture && canvas) {
			try { CanvasCapture.dispose(); } catch (_) {}
			CanvasCapture.init(canvas, { showRecDot: true, showDialogs: true, showAlerts: true, recDotCSS: { left: '0', right: 'auto' } });
			CanvasCapture.bindKeyToVideoRecord('v', {
				format: CanvasCapture.WEBM,
				name: 'screen_recording',
				fps: RECORD_FPS,
				quality: 1,
			});
		}
	}

	// Add some settings to gui.
	const settings = pane.addFolder({
		title,
		expanded: false,
	});
	settings.addInput(webGLSettings, 'webGLVersion', {
		options: availableWebGLVersions,
		label: 'WebGL Version',
	}).on('change', reloadExampleWithNewParams);

	// Add info modal.
	const modalOptions = {
		showModal: () => {
			// Show/hide overlay, otherwise clicks are passing through due to fixed/abs positioning of modal.
			MicroModal.show('modal-1', { onClose: () => { setTimeout(() => { overlay.style.display = 'none'; }, 500); } });
			overlay.style.display = 'block';
		},
		sourceCode: () => {
			document.getElementById('sourceCode').click();
		},
	}
	pane.addButton({ title: 'About'}).on('click', modalOptions.showModal);
	pane.addButton({ title: 'View Code'}).on('click', modalOptions.sourceCode);

	// Load example app.
	reloadExampleWithNewParams();

	// Disable gestures.
	function disableZoom(e) {
		e.preventDefault();
		const scale = 'scale(1)';
		// @ts-ignore
		document.body.style.webkitTransform =  scale;    // Chrome, Opera, Safari
		// @ts-ignore
		document.body.style.msTransform =   scale;       // IE 9
		document.body.style.transform = scale;
	}

	let numFrames = 0;

	function outerLoop() {
		// Check if we have a valid composer and it hasn't been disposed
		if (composer && composer.tick && !composer._disposed) {
			const { fps, numTicks } = composer.tick();
			if (numTicks % 10 === 0) {
				settings.title = `${title} (${fps.toFixed(1)} FPS)`;
			}
		}
		
		// Run example loop only if it exists and composer is valid
		if (loop && composer && !composer._disposed) {
			try {
				loop();
			} catch (error) {
				console.warn('Error en loop de ejemplo; desactivando loop pero manteniendo RAF:', error);
				// Desactivar el loop para evitar errores, pero mantener RAF activo
				loop = null;
				// No cancelamos requestAnimationFrame; permitimos que futuras cargas restablezcan el loop
			}
		}

		// Screen recording.
		if (CanvasCapture) {
			CanvasCapture.checkHotkeys();
			if (CanvasCapture.isRecording()) {
				CanvasCapture.recordFrame();
				numFrames++;
				console.log(`Recording duration: ${(numFrames / RECORD_FPS).toFixed(2)} sec`);
			} else {
				numFrames = 0;
			}
		}
		
		// Always schedule next frame; loop/composer may be set asynchronously
		window.currentAnimationId = window.requestAnimationFrame(outerLoop);
	}
	// Start loop.
	outerLoop();

	// Global function to apply a new example result (used by main on example switch)
	window.applyExampleResult = function(newResult) {
		({ loop, composer, dispose, canvas } = newResult || {});
		if (canvas) {
			canvas.addEventListener('gesturestart', disableZoom);
			canvas.addEventListener('gesturechange', disableZoom);
			canvas.addEventListener('gestureend', disableZoom);
		}
		if (CanvasCapture) {
			try { CanvasCapture.dispose(); } catch (_) {}
			if (canvas) {
				CanvasCapture.init(canvas, { showRecDot: true, showDialogs: true, showAlerts: true, recDotCSS: { left: '0', right: 'auto' } });
				CanvasCapture.bindKeyToVideoRecord('v', {
					format: CanvasCapture.WEBM,
					name: 'screen_recording',
					fps: RECORD_FPS,
					quality: 1,
				});
			}
		}
	};
}