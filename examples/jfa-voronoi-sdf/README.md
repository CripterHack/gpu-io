# JFA Voronoi + SDF

This example builds a Voronoi diagram using the Jump Flooding Algorithm (JFA) and derives a distance field (DF/SDF) from it. All computation runs on the GPU via fragment shaders using the `gpu-io` library.

## Interaction

- Click and drag to move the seed closest to the pointer.
- Toggle between Voronoi and SDF views.
- Enable borders and isolines; adjust their intensity and frequency.
- Change the number of seeds and re-randomize them.

## Files

- `index.html` and `index.js`: example app and UI built with Tweakpane.
- `shaders/`: shaders for JFA, Voronoi rendering, and SDF.

This example is self-contained under `examples/`, alongside its version integrated into `examples/auto-performance`.