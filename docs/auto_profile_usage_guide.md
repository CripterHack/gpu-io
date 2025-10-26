# GPU-IO Auto-Profile Performance System Usage Guide

## Overview

The auto-profile performance system automatically adjusts rendering quality based on device capabilities and real-time performance metrics. It provides seamless performance optimization without manual intervention while maintaining visual quality as high as possible.

## How It Works

The system operates in three phases:

1. **Device Detection**: Automatically detects device capabilities (WebGL2 support, memory, CPU cores, screen resolution)
2. **Initial Quality Selection**: Chooses an appropriate starting quality preset based on detected capabilities
3. **Runtime Adaptation**: Monitors FPS and automatically adjusts quality up or down to maintain target performance

## Automatic Usage (Recommended)

### Basic Automatic Mode

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: true  // Enable with default settings
});
```

This automatically:
- Detects device capabilities
- Selects optimal initial quality preset
- Monitors performance and adjusts quality in real-time
- Targets 60 FPS by default

### Advanced Automatic Mode

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: {
    targetFPS: 60,           // Target frame rate (default: 60)
    debugLogging: true,      // Enable performance debug logs
    onPerformanceUpdate: (metrics) => {
      console.log(`FPS: ${metrics.fps}, Ticks: ${metrics.numTicks}`);
    },
    onRequestDowngrade: (targetProfileId) => {
      console.log(`Quality downgraded to: ${targetProfileId}`);
    }
  }
});
```

## Manual Override Options

### Force Specific Quality Preset

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: {
    profileId: 'medium',     // Force medium quality
    targetFPS: 60,
    debugLogging: true
  }
});
```

### Runtime Quality Changes

```javascript
// Change quality preset at runtime
composer.setQualityPreset('high');

// Get current quality preset
const currentPreset = composer.getCurrentQualityPreset();
console.log(`Current quality: ${currentPreset?.id}`);

// Reset to original configuration
composer.resetPerformanceConfig();
```

## Quality Presets

The system includes four quality presets:

### High Quality
- **Best visual quality**
- **Particle Count**: 100,000
- **Jacobi Iterations**: 3
- **Render Passes**: 3
- **Target Frame Budget**: 22ms (~45 FPS)

### Medium Quality
- **Balanced performance/quality**
- **Particle Count**: 70,000
- **Jacobi Iterations**: 3
- **Render Passes**: 2
- **Target Frame Budget**: 28ms (~36 FPS)

### Low Quality
- **Performance focused**
- **Particle Count**: 45,000
- **Jacobi Iterations**: 2
- **Render Passes**: 1
- **Target Frame Budget**: 32ms (~31 FPS)

### Minimal Quality
- **Maximum performance**
- **Particle Count**: 25,000
- **Jacobi Iterations**: 1
- **Render Passes**: 1
- **Target Frame Budget**: 36ms (~28 FPS)

## Device Detection Logic

The system automatically detects:

- **WebGL2 Support**: +1 quality score
- **Device Memory**: 
  - 8GB+: +2 score
  - 4GB+: +1 score
  - 2GB+: 0 score
  - <2GB: -1 score
- **CPU Cores**:
  - 8+: +2 score
  - 4+: +1 score
  - 2+: 0 score
  - 1: -1 score
- **High DPI Displays**: -1 score (more pixels to render)
- **Reduced Motion Preference**: Forces minimal quality

## Runtime Performance Adaptation

The system continuously monitors performance:

- **Downgrade Trigger**: FPS drops below 80% of target (e.g., <48 FPS for 60 FPS target)
- **Upgrade Trigger**: FPS exceeds 120% of target (e.g., >72 FPS for 60 FPS target)
- **Upgrade Frequency**: Checked every 120 ticks (less frequent than downgrades)

## Accessibility Support

The system respects user preferences:

```javascript
// Automatically detects prefers-reduced-motion
// and selects minimal quality preset
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: true
});

// Override reduced motion detection
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: {
    profileId: 'medium'  // Override automatic minimal selection
  }
});
```

## Debug and Monitoring

### Enable Debug Logging

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: {
    debugLogging: true
  }
});
```

Debug logs show:
- Initial quality selection reasoning
- Runtime quality changes with FPS metrics
- Performance configuration applications

### Performance Callbacks

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: {
    onPerformanceUpdate: (metrics) => {
      // Called every frame with performance data
      updatePerformanceUI(metrics.fps, metrics.numTicks);
    },
    onRequestDowngrade: (targetProfileId) => {
      // Called when quality is downgraded
      showQualityNotification(`Quality reduced to ${targetProfileId}`);
    },
    onCanvasResize: (width, height) => {
      // Called when canvas is resized
      console.log(`Canvas resized: ${width}x${height}`);
    }
  }
});
```

## Integration with Existing Code

The auto-profile system is designed to be non-intrusive:

### Minimal Changes Required

```javascript
// Before: Manual setup
const composer = new GPUComposer({ canvas });

// After: Automatic optimization
const composer = new GPUComposer({ 
  canvas,
  autoPerformanceProfile: true 
});
```

### No Breaking Changes

- Existing GPUComposer code continues to work unchanged
- Auto-profile is opt-in via the `autoPerformanceProfile` option
- Manual quality control methods are still available

## Best Practices

1. **Start with Basic Mode**: Use `autoPerformanceProfile: true` for most applications
2. **Enable Debug Logging**: During development to understand quality selection
3. **Monitor Performance**: Use callbacks to track system behavior
4. **Test on Various Devices**: Verify quality selection across different hardware
5. **Respect User Preferences**: The system automatically handles reduced motion preferences

## Troubleshooting

### Performance Still Poor
- Check if WebGL2 is supported
- Verify device has sufficient memory (>2GB recommended)
- Consider manually setting a lower quality preset

### Quality Too Low
- Override automatic detection with specific preset
- Check for reduced motion preferences
- Verify device capabilities are detected correctly

### Frequent Quality Changes
- Adjust `targetFPS` to be more conservative
- Check for background processes affecting performance
- Consider using a fixed quality preset for consistent experience

## Example: Complete Integration

```javascript
// Complete example with monitoring and user controls
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: {
    targetFPS: 60,
    debugLogging: true,
    onPerformanceUpdate: (metrics) => {
      document.getElementById('fps-display').textContent = 
        `FPS: ${Math.round(metrics.fps)}`;
    },
    onRequestDowngrade: (targetProfileId) => {
      showNotification(`Performance adjusted to ${targetProfileId} quality`);
    }
  }
});

// Add user controls
document.getElementById('quality-high').onclick = () => 
  composer.setQualityPreset('high');
document.getElementById('quality-auto').onclick = () => 
  composer.resetPerformanceConfig();

// Start rendering loop
function animate() {
  composer.tick();
  requestAnimationFrame(animate);
}
animate();
```

This system ensures optimal performance across all devices while maintaining the highest possible visual quality for each user's hardware capabilities.