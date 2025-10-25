# Performance Testing Matrix

This document describes how to execute the performance testing matrix locally with different browser configurations for regression and low-spec test coverage.

## Overview

The performance testing matrix includes:
- **ChromeLowSpec**: Simulates low-end devices with software rendering
- **ChromeHighSpec**: Simulates high-end devices with hardware acceleration
- **Standard Chrome**: Default configuration for baseline testing

## Test Configurations

### ChromeLowSpec Configuration
Simulates low-end devices with limited resources:
- Software rendering via SwiftShader WebGL
- Limited memory allocation (256MB)
- Disabled GPU acceleration
- Memory pressure simulation

### ChromeHighSpec Configuration  
Simulates high-end devices with optimal performance:
- Hardware GPU acceleration enabled
- Increased memory allocation (2GB)
- GPU rasterization and zero-copy enabled
- Hardware overlays support

## Running Tests

### All Tests (Default)
```bash
npm test
```
Runs the complete test suite with the default Chrome headless configuration.

### Low-Spec Device Testing
```bash
npx karma start --browsers ChromeLowSpec --single-run
```
Tests performance on simulated low-end devices to ensure:
- Graceful degradation of quality presets
- Proper fallback to software rendering
- Memory-constrained operation

### High-Spec Device Testing
```bash
npx karma start --browsers ChromeHighSpec --single-run
```
Tests performance on simulated high-end devices to verify:
- Optimal quality preset selection
- Hardware acceleration utilization
- Maximum performance capabilities

### Interactive Browser Testing
```bash
npx karma start --browsers Chrome
```
Opens an interactive browser session for manual testing of:
- Fluid background performance with different presets
- Real-time FPS monitoring
- Quality preset transitions
- Performance throttling simulation

## Performance Test Coverage

### Auto-Profile Functionality
- Quality preset detection based on device capabilities
- Automatic quality adjustment based on performance
- Runtime performance monitoring and downgrade detection
- Integration with GPUComposer performance adapter

### Browser Integration Tests
The browser test suite (`tests/browser/main.js`) includes:
- Interactive performance testing UI
- Quality preset comparison tools
- FPS monitoring and charting
- Synthetic performance throttling

### Test Matrix Execution
To run the complete performance test matrix:

```bash
# Run all configurations sequentially
npm test
npx karma start --browsers ChromeLowSpec --single-run
npx karma start --browsers ChromeHighSpec --single-run
```

## Performance Metrics

### Monitored Parameters
- **FPS (Frames Per Second)**: Real-time rendering performance
- **Frame Budget**: Target frame time in milliseconds
- **Quality Preset**: Current active quality configuration
- **Downgrade Events**: Automatic quality reductions

### Quality Presets
- **High**: High quality (22ms frame budget, ~45 FPS target)
- **Medium**: Medium quality (28ms frame budget, ~36 FPS target)  
- **Low**: Low quality (32ms frame budget, ~31 FPS target)
- **Minimal**: Minimal quality (36ms frame budget, ~28 FPS target)

## Troubleshooting

### WebGL Context Issues
If tests fail with "Unable to init webgl context":
- Ensure SwiftShader is properly configured for ChromeLowSpec
- Check that hardware acceleration is available for ChromeHighSpec
- Verify Chrome version compatibility

### Performance Test Failures
If performance tests fail:
- Check that quality presets are properly applied before testing
- Verify frame budget calculations match expected thresholds
- Ensure performance adapter is initialized correctly

### Memory Issues
For memory-related test failures:
- Increase memory limits in karma configuration
- Check for memory leaks in test cleanup
- Verify proper disposal of GPU resources

## Configuration Files

### Karma Configuration
The test matrix is configured in `karma.conf.js` with custom browser launchers:
- ChromeLowSpec: Software rendering with memory constraints
- ChromeHighSpec: Hardware acceleration with optimal settings

### Test Files
- `tests/mocha/performanceAutoProfile.js`: Core performance functionality tests
- `tests/browser/main.js`: Interactive browser performance testing
- `src/performance/autoProfile.ts`: Auto-profile implementation
- `src/PerformanceAdapter.ts`: Performance adapter integration

## Best Practices

1. **Run the complete test matrix** before performance-related changes
2. **Test on both low-spec and high-spec configurations** to ensure compatibility
3. **Monitor performance metrics** during development
4. **Verify graceful degradation** on resource-constrained devices
5. **Document performance changes** in commit messages

## Integration with CI/CD

The performance test matrix can be integrated into continuous integration:

```yaml
# Example GitHub Actions configuration
- name: Run Performance Tests
  run: |
    npm test
    npx karma start --browsers ChromeLowSpec --single-run
    npx karma start --browsers ChromeHighSpec --single-run
```

This ensures performance regression testing across different device capabilities in automated builds.