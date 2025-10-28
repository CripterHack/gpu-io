// Render SDF/DF with optional isolines
in vec2 v_uv;
uniform sampler2D u_dist;
uniform float u_isoFreq;
uniform bool u_showIsolines;
// Simple grayscale colormap
out vec4 out_color;

void main() {
    float d = texture(u_dist, v_uv).x;
    // Normalize by a rough scale to keep values in [0,1]
    float norm = clamp(d / 512.0, 0.0, 1.0);
    vec3 base = vec3(norm);
    if (u_showIsolines) {
        float iso = step(0.95, fract(d * u_isoFreq));
        base = mix(base, vec3(0.0), iso);
    }
    out_color = vec4(base, 1.0);
}