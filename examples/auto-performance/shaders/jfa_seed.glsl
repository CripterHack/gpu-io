// Seed initialization for JFA using drawLayerAsPoints()
// Writes candidate = [seedUV.x, seedUV.y, normalizedId, 0]
// Available varyings: v_index, v_uv_position, v_position
in vec2 v_uv;
flat in int v_index;
uniform float u_seedCount;
out vec4 out_nearest;

void main() {
    // Normalize ID to [0,1]; guard for 1 seed
    float denom = max(1.0, u_seedCount - 1.0);
    float idNorm = float(v_index) / denom;
    // Write seed UV as current fragment UV
    out_nearest = vec4(v_uv, idNorm, 0.0);
}