/**
 * Performance adapter for translating quality presets to composer configuration
 * This adapter provides runtime hooks for adjusting performance parameters
 */

import type { GPUComposer } from './GPUComposer';
import { 
	AutoProfileOptions, 
	QualityPreset, 
	QualityPresetId,
	translatePresetToConfig, 
	QUALITY_PRESETS 
} from './performance/autoProfile';

/**
 * Configuration interface for performance-sensitive parameters
 */
export interface PerformanceConfig {
	particleCount?: number;
	jacobiIterations?: number;
	renderPasses?: number;
	velocityScale?: number;
	trailFadeRate?: number;
	maxVelocity?: number;
	touchForceScale?: number;
}

/**
 * Performance adapter class that manages quality preset application
 */
export class PerformanceAdapter {
	private _composer: GPUComposer;
	private _options: AutoProfileOptions;
	private _currentPreset?: QualityPreset;
	private _originalConfig?: PerformanceConfig;
	private _debugLogging: boolean;

	constructor(composer: GPUComposer, options: AutoProfileOptions) {
		this._composer = composer;
		this._options = options;
		// Debug logging disabled by default
		this._debugLogging = false;
		
		// Store original configuration for fallback
		this._originalConfig = this._captureCurrentConfig();
	}

	/**
	 * Apply a quality preset to the composer
	 */
	applyQualityPreset(presetId: QualityPresetId): void {
		const preset = QUALITY_PRESETS[presetId];
		if (!preset) {
			console.warn(`Unknown quality preset: ${presetId}`);
			return;
		}

		this._currentPreset = preset;
		const config = translatePresetToConfig(preset);

		// Apply configuration to composer
		this._applyPerformanceConfig(config);

		// Debug logging
		if (this._debugLogging) {
			console.log(`[GPU-IO Performance] Applied quality preset: ${presetId}`, {
				preset,
				config,
				timestamp: performance.now()
			});
		}

		// Notify callback if provided
		if (this._options.onPerformanceUpdate) {
			const { fps, numTicks } = this._composer.tick();
			this._options.onPerformanceUpdate({
				fps,
				numTicks,
				timestamp: performance.now(),
				canvasWidth: this._composer.canvas.width,
				canvasHeight: this._composer.canvas.height,
			});
		}
	}

	/**
	 * Apply a quality preset to the composer configuration
	 */
	applyPreset(preset: QualityPreset): void {
		if (!this._composer) return;

		// Translate preset to configuration
		const config = translatePresetToConfig(preset);
		
		// Apply configuration to composer
		this._applyPerformanceConfig(config);
		
		// Store current preset
		this._currentPreset = preset;
		
		if (this._debugLogging) {
			console.log(`[PerformanceAdapter] Applied preset:`, preset);
		}
	}

	/**
	 * Get the currently applied quality preset
	 */
	getCurrentPreset(): QualityPreset | undefined {
		return this._currentPreset;
	}

	/**
	 * Reset to original configuration
	 */
	resetToOriginal(): void {
		if (this._originalConfig) {
			this._applyPerformanceConfig(this._originalConfig);
			this._currentPreset = undefined;

			if (this._debugLogging) {
				console.log('[GPU-IO Performance] Reset to original configuration');
			}
		}
	}

	/**
	 * Capture current composer configuration
	 */
	private _captureCurrentConfig(): PerformanceConfig {
		// Note: Since GPUComposer doesn't currently expose these parameters directly,
		// we'll store default values that can be overridden by presets
		return {
			particleCount: 50000, // Default reasonable value
			jacobiIterations: 2,
			renderPasses: 2,
			velocityScale: 10,
			trailFadeRate: 0.1,
			maxVelocity: 25,
			touchForceScale: 1.5
		};
	}

	/**
	 * Apply performance configuration to the composer
	 * This method serves as a bridge between preset values and composer internals
	 */
	private _applyPerformanceConfig(config: PerformanceConfig): void {
		// Store configuration for runtime access
		// Note: The actual application of these parameters would typically happen
		// in the simulation loop or when creating GPU programs/layers
		
		// For now, we store the configuration so it can be accessed by
		// simulation code that uses the composer
		(this._composer as any)._performanceConfig = config;

		// Future enhancement: Apply configuration directly to composer internals
		// This would require modifications to how GPUComposer manages simulation parameters
	}

	/**
	 * Get current performance configuration
	 */
	getPerformanceConfig(): PerformanceConfig | undefined {
		return (this._composer as any)._performanceConfig;
	}

	/**
	 * Check if performance downgrade is recommended based on frame timing
	 */
	shouldDowngrade(currentFPS: number): boolean {
		if (!this._currentPreset) return false;
		
		const targetFPS = 1000 / this._currentPreset.frameBudget;
		return currentFPS < targetFPS * 0.8; // 20% tolerance
	}

	/**
	 * Dispose of the adapter
	 */
	dispose(): void {
		this._currentPreset = undefined;
		this._originalConfig = undefined;
	}
}