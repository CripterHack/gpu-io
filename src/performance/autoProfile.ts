/**
 * Auto-performance profiling module for GPU-IO
 * Ported from fluid-background.js with TypeScript types and dependency injection
 */

// Quality preset type definitions
export interface QualityPreset {
  readonly id: QualityPresetId;
  readonly particleDensity: number;
  readonly maxParticles: number;
  readonly particleLifetime: number;
  readonly numJacobiSteps: number;
  readonly numRenderSteps: number;
  readonly velocityScaleFactor: number;
  readonly maxVelocity: number;
  readonly trailLength: number;
  readonly touchForceScale: number;
  readonly frameBudget: number;
}

// Quality preset IDs - keeping Spanish names internally but documenting English mapping
export type QualityPresetId = 'alto' | 'medio' | 'bajo' | 'minimo';

// English mapping for external consumers:
// 'alto' = 'high', 'medio' = 'medium', 'bajo' = 'low', 'minimo' = 'minimal'
export const QUALITY_PRESET_MAPPING = {
  high: 'alto' as const,
  medium: 'medio' as const,
  low: 'bajo' as const,
  minimal: 'minimo' as const,
} as const;

export const QUALITY_PRESETS: Record<QualityPresetId, QualityPreset> = {
  alto: {
    id: 'alto',
    particleDensity: 0.1,
    maxParticles: 100000,
    particleLifetime: 1000,
    numJacobiSteps: 3,
    numRenderSteps: 3,
    velocityScaleFactor: 8,
    maxVelocity: 30,
    trailLength: 18,
    touchForceScale: 2,
    frameBudget: 22
  },
  medio: {
    id: 'medio',
    particleDensity: 0.07,
    maxParticles: 70000,
    particleLifetime: 900,
    numJacobiSteps: 3,
    numRenderSteps: 2,
    velocityScaleFactor: 10,
    maxVelocity: 26,
    trailLength: 14,
    touchForceScale: 1.8,
    frameBudget: 28
  },
  bajo: {
    id: 'bajo',
    particleDensity: 0.045,
    maxParticles: 45000,
    particleLifetime: 800,
    numJacobiSteps: 2,
    numRenderSteps: 1,
    velocityScaleFactor: 12,
    maxVelocity: 22,
    trailLength: 12,
    touchForceScale: 1.5,
    frameBudget: 32
  },
  minimo: {
    id: 'minimo',
    particleDensity: 0.03,
    maxParticles: 25000,
    particleLifetime: 700,
    numJacobiSteps: 1,
    numRenderSteps: 1,
    velocityScaleFactor: 14,
    maxVelocity: 18,
    trailLength: 10,
    touchForceScale: 1.2,
    frameBudget: 36
  }
};

export const QUALITY_SEQUENCE: QualityPresetId[] = ['alto', 'medio', 'bajo', 'minimo'];

// Auto-profile options interface
export interface AutoProfileOptions {
  /** Override automatic detection with specific profile */
  profileId?: QualityPresetId;
  /** Target FPS for performance monitoring (default: 60) */
  targetFPS?: number;
  /** Enable debug logging for performance changes */
  debugLogging?: boolean;
  /** Callback when performance downgrade is requested */
  onRequestDowngrade?: (targetProfileId: QualityPresetId) => void;
  /** Custom device capabilities for testing */
  deviceCapabilities?: DeviceCapabilities;
  /** Callback for performance metrics updates */
  onPerformanceUpdate?: (metrics: {
    fps: number;
    numTicks: number;
    timestamp: number;
    canvasWidth: number;
    canvasHeight: number;
  }) => void;
  /** Callback for canvas resize events */
  onCanvasResize?: (width: number, height: number) => void;
}

// Device capabilities interface for dependency injection
export interface DeviceCapabilities {
  supportsWebGL2: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  devicePixelRatio?: number;
  screenWidth?: number;
  screenHeight?: number;
  prefersReducedMotion?: boolean;
  saveData?: boolean;
}

// Browser environment interface for SSR safety
export interface BrowserEnvironment {
  window?: {
    matchMedia?: (query: string) => MediaQueryList;
    devicePixelRatio?: number;
    innerWidth?: number;
    innerHeight?: number;
  };
  navigator?: {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: { saveData?: boolean; addEventListener?: (event: string, handler: () => void) => void; removeEventListener?: (event: string, handler: () => void) => void; };
    mozConnection?: { saveData?: boolean };
    webkitConnection?: { saveData?: boolean };
  } & {
    [key: string]: any;
  };
}

/**
 * Get the next lower quality preset ID in the sequence
 */
export function getNextQualityId(id: QualityPresetId, direction: 'up' | 'down' = 'down'): QualityPresetId | null {
  const index = QUALITY_SEQUENCE.indexOf(id);
  if (index === -1) {
    return null;
  }
  
  if (direction === 'down') {
    // Move to lower quality (higher index)
    if (index >= QUALITY_SEQUENCE.length - 1) {
      return null;
    }
    return QUALITY_SEQUENCE[index + 1];
  } else {
    // Move to higher quality (lower index)
    if (index <= 0) {
      return null;
    }
    return QUALITY_SEQUENCE[index - 1];
  }
}

/**
 * Check if user prefers reduced motion (SSR-safe)
 */
export function prefersReducedMotion(env?: BrowserEnvironment): boolean {
  const window = env?.window || (typeof globalThis !== 'undefined' ? globalThis.window : undefined);
  
  if (!window || !window.matchMedia) {
    return false;
  }
  
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (error) {
    return false;
  }
}

/**
 * Detect optimal quality profile based on device capabilities
 */
export function detectQualityProfile(
  capabilities: DeviceCapabilities,
  env?: BrowserEnvironment
): QualityPresetId {
  // Check for reduced motion preference first
  if (capabilities.prefersReducedMotion ?? prefersReducedMotion(env)) {
    return 'minimo';
  }

  // Check for data saver mode
  const navigator = env?.navigator || (typeof globalThis !== 'undefined' ? (globalThis as any).navigator : undefined);
  const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
  
  if (capabilities.saveData ?? (connection && connection.saveData)) {
    return 'bajo';
  }

  // Extract device metrics with fallbacks
  const deviceMemory = capabilities.deviceMemory ?? ((navigator as any)?.deviceMemory || 0);
  const cores = capabilities.hardwareConcurrency ?? (navigator?.hardwareConcurrency || 0);
  const pixelRatio = capabilities.devicePixelRatio ?? (env?.window?.devicePixelRatio || 1);
  const screenWidth = capabilities.screenWidth ?? (env?.window?.innerWidth || 0);
  const screenHeight = capabilities.screenHeight ?? (env?.window?.innerHeight || 0);
  const screenArea = screenWidth * screenHeight;

  let score = 0;

  // WebGL2 support
  if (capabilities.supportsWebGL2) {
    score += 1;
  } else {
    score -= 2;
  }

  // Device memory scoring
  if (deviceMemory >= 8) {
    score += 2;
  } else if (deviceMemory >= 4) {
    score += 1;
  } else if (deviceMemory > 0) {
    score -= 1;
  } else {
    score -= 1; // Unknown memory
  }

  // CPU cores scoring
  if (cores >= 8) {
    score += 2;
  } else if (cores >= 4) {
    score += 1;
  } else if (cores > 0) {
    score -= 1;
  } else {
    score -= 1; // Unknown cores
  }

  // High pixel ratio penalty
  if (pixelRatio > 2.5) {
    score -= 1;
  }

  // Large screen penalty
  if (screenArea > 2500000) {
    score -= 1;
  }

  // Low memory penalty
  if (deviceMemory && deviceMemory <= 2) {
    score -= 1;
  }

  // Map score to quality preset
  if (score <= -1) {
    return 'bajo';
  }
  if (score <= 1) {
    return 'medio';
  }
  return 'alto';
}

/**
 * Create fluid background with auto-performance profiling
 * This is a simplified version focused on the profiling logic
 */
export function createFluidBackground(
  gpuioAPI: any, // Will be properly typed when integrated with GPUComposer
  options: AutoProfileOptions = {}
): { dispose: () => void; currentProfile: QualityPresetId } {
  const { profileId, onRequestDowngrade, deviceCapabilities } = options;

  // Detect capabilities if not provided
  const capabilities: DeviceCapabilities = deviceCapabilities || {
    supportsWebGL2: typeof gpuioAPI?.isWebGL2Supported === 'function' ? gpuioAPI.isWebGL2Supported() : true,
  };

  // Select quality profile
  const selectedProfileId = QUALITY_PRESETS[profileId as QualityPresetId] 
    ? profileId as QualityPresetId 
    : detectQualityProfile(capabilities);

  const quality = QUALITY_PRESETS[selectedProfileId] || QUALITY_PRESETS.minimo;

  // Log selected profile in development
  if (typeof globalThis !== 'undefined' && 
      (typeof (globalThis as any).process === 'undefined' || 
       (globalThis as any).process?.env?.NODE_ENV !== 'production')) {
    console.info(`Auto-performance profile selected: "${selectedProfileId}"`);
  }

  // Setup cleanup callbacks for media listeners
  const cleanupCallbacks: (() => void)[] = [];

  // Monitor reduced motion changes
  const setupMediaListener = (
    query: MediaQueryList | null,
    handler: (event: MediaQueryListEvent) => void
  ) => {
    if (!query) return;

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handler);
      cleanupCallbacks.push(() => query.removeEventListener('change', handler));
    } else if (typeof (query as any).addListener === 'function') {
      (query as any).addListener(handler);
      cleanupCallbacks.push(() => (query as any).removeListener(handler));
    }
  };

  // Setup reduced motion monitoring
  const window = typeof globalThis !== 'undefined' ? globalThis.window : undefined;
  const reduceMotionQuery = window?.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  
  setupMediaListener(reduceMotionQuery, (event) => {
    if (event.matches && onRequestDowngrade) {
      onRequestDowngrade('minimo');
    }
  });

  // Setup connection monitoring
  const navigator = typeof globalThis !== 'undefined' ? (globalThis as any).navigator : undefined;
  const connection = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
  
  const handleConnectionChange = () => {
    if (connection?.saveData && onRequestDowngrade) {
      const targetProfile = selectedProfileId === 'minimo' ? 'minimo' : 'bajo';
      onRequestDowngrade(targetProfile);
    }
  };

  if (connection) {
    handleConnectionChange();
    if (typeof connection.addEventListener === 'function') {
      connection.addEventListener('change', handleConnectionChange);
      cleanupCallbacks.push(() => connection.removeEventListener!('change', handleConnectionChange));
    }
  }

  return {
    dispose: () => {
      cleanupCallbacks.forEach(fn => fn());
      cleanupCallbacks.length = 0;
    },
    currentProfile: selectedProfileId
  };
}

/**
 * Utility to translate quality preset properties to composer configuration
 */
export function translatePresetToConfig(preset: QualityPreset): {
  particleCount: number;
  jacobiIterations: number;
  renderPasses: number;
  velocityScale: number;
  trailFadeRate: number;
} {
  return {
    particleCount: preset.maxParticles,
    jacobiIterations: preset.numJacobiSteps,
    renderPasses: preset.numRenderSteps,
    velocityScale: preset.velocityScaleFactor,
    trailFadeRate: 1 / preset.trailLength,
  };
}