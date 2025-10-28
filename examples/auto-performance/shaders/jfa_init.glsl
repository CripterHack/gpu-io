// JFA initialization: fill nearest texture with empty candidate
in vec2 v_uv;
uniform float u_emptyId; // e.g., -1.0
out vec4 out_nearest;
void main() {
    // xy: seed UV (unused here), z: normalized ID, w: flag
    out_nearest = vec4(0.0, 0.0, u_emptyId, 0.0);
}