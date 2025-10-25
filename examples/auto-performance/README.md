# Auto-Performance Tuning Demo

This example demonstrates **gpu-io's automatic performance tuning** capabilities. The simulation dynamically adjusts its quality settings based on your device's performance to maintain smooth framerates while maximizing visual quality.

## Features

- **Automatic Quality Detection**: Detects device capabilities and selects optimal quality preset
- **Real-time Performance Monitoring**: Tracks FPS and adjusts quality dynamically
- **Manual Override Controls**: Toggle between automatic and manual quality selection
- **Four Quality Presets**: 
  - `high` - Maximum quality with highest particle count
  - `medium` - Balanced quality and performance  
  - `low` - Reduced quality for better performance
  - `minimal` - Minimal quality for maximum compatibility
- **Performance Metrics Display**: Real-time FPS counter and quality information
- **Interactive Fluid Simulation**: Touch/mouse interaction with fluid dynamics

## Controls

### UI Controls (Right Panel)
- **Auto-Tuning**: Enable/disable automatic performance adjustment
- **Manual Quality**: Select specific quality preset when auto-tuning is off
- **Show FPS**: Toggle FPS and performance information display
- **Show Quality Info**: Toggle detailed quality settings display

### Keyboard Shortcuts
- `1-4`: Switch to quality presets (high, medium, low, minimal)
- `a`: Toggle auto-tuning on/off
- `v`: Save screenshot

### Mouse/Touch
- **Move**: Interact with fluid simulation
- **Click/Touch**: Apply force to fluid

## Quality Presets Comparison

| Preset | Particle Density | Max Particles | Jacobi Steps | Render Steps | Target FPS |
|--------|------------------|---------------|--------------|--------------|------------|
| High   | 0.1              | 100,000       | 3            | 3            | 22+        |
| Medium | 0.07             | 70,000        | 3            | 2            | 28+        |
| Low    | 0.045            | 45,000        | 2            | 1            | 32+        |
| Minimal| 0.03             | 25,000        | 1            | 1            | 36+        |

## Auto-Tuning Behavior

The auto-tuning system:

1. **Monitors Performance**: Tracks average FPS over the last 60 frames
2. **Downgrades Quality**: If FPS drops 5+ below target, switches to lower quality preset
3. **Upgrades Quality**: If FPS is 10+ above target, switches to higher quality preset
4. **Respects User Preferences**: Honors reduced-motion settings by default
5. **Provides Callbacks**: Notifies application of quality changes for custom handling

## Reduced-Motion Support

For users with `prefers-reduced-motion` enabled:
- Auto-tuning may be disabled by default
- Can be manually enabled via controls
- Set `respectReducedMotion: false` in configuration to override

## Integration Example

```javascript
const composer = new GPUComposer({
  canvas,
  autoPerformance: {
    targetFPS: 60,
    debugLogging: true,
    onRequestDowngrade: (targetProfileId) => {
      // Handle quality change
      updateSimulationQuality(targetProfileId);
    }
  }
});
```

## Technical Implementation

This example showcases:
- Dynamic particle system scaling
- Adaptive simulation parameters
- Real-time performance monitoring
- Quality preset management
- User preference detection
- Smooth quality transitions

The auto-tuning system is designed to be non-intrusive and can be easily integrated into existing gpu-io applications with minimal code changes.