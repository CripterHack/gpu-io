# Auto-Performance Tuning Demo

This example demonstrates GPU-IO's automatic performance tuning. The simulation adjusts quality based on device capabilities and real-time FPS to maintain smooth rendering while maximizing visual quality.

## Features

- Automatic quality detection and selection
- Real-time FPS monitoring with dynamic quality adjustments
- Manual override controls (preset switching and reset)
- Four quality presets (high, medium, low, minimal)
- Performance metrics display (FPS, current preset)

## Controls

- Auto-Tuning: Enable/disable automatic performance adjustment
- Manual Quality: Select a specific preset when auto-tuning is off
- Show FPS / Quality Info: Toggle performance and preset information
- Shortcuts: `1–4` select presets, `a` toggles auto-tuning, `v` saves a screenshot

## Quality Presets Comparison

| Preset  | Particle Density | Max Particles | Jacobi Steps | Render Steps | Frame Budget (ms) | Approx FPS |
|--------|------------------|---------------|--------------|--------------|-------------------|------------|
| High   | 0.1              | 100,000       | 3            | 3            | 22                | ~45        |
| Medium | 0.07             | 70,000        | 3            | 2            | 28                | ~36        |
| Low    | 0.045            | 45,000        | 2            | 1            | 32                | ~31        |
| Minimal| 0.03             | 25,000        | 1            | 1            | 36                | ~28        |

## Auto-Tuning Behavior

- Monitors performance using a low-pass filtered FPS via `GPUComposer.tick()`
- Downgrades when FPS < 80% of target (e.g., <48 FPS for target 60)
- Upgrades when FPS > 120% of target, checked less frequently (every ~120 ticks)
- Respects user preferences; reduced motion selects the minimal preset
- Callbacks: `onPerformanceUpdate` (per frame), `onCanvasResize` (resize), `onRequestDowngrade` (environment-triggered downgrade)

## Reduced-Motion Support

- Detects `prefers-reduced-motion` and selects `minimal` preset automatically
- Override with `autoPerformanceProfile: { profileId: 'medium' }` if desired

## Usage Examples

### Basic Automatic Mode (Recommended)

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: true
});

function animate() {
  composer.tick();
  requestAnimationFrame(animate);
}
animate();
```

Note: In TypeScript, prefer `autoPerformanceProfile: {}` or an options object instead of `true`.

### Automatic with Debug Monitoring

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: {
    targetFPS: 60,
    debugLogging: true,
    onPerformanceUpdate: (metrics) => {
      document.getElementById('fps-counter')?.textContent = `${Math.round(metrics.fps)} FPS`;
    },
    onRequestDowngrade: (targetProfileId) => {
      showNotification(`Quality adjusted to ${targetProfileId}`);
    }
  }
});
```

### Manual Override and Runtime Controls

```javascript
const composer = new GPUComposer({
  canvas: document.getElementById('webgl-canvas'),
  autoPerformanceProfile: { profileId: 'medium' }
});

document.getElementById('quality-high').onclick = () => {
  composer.setQualityPreset('high');
};

document.getElementById('quality-auto').onclick = () => {
  composer.resetPerformanceConfig();
};
```

This auto-tuning system is non-intrusive and integrates into existing GPU-IO apps with minimal changes while providing robust defaults and flexible customization.