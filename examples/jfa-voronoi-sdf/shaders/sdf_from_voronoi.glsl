// Compute Distance Field (DF) or Signed Distance Field (SDF) from nearest candidate
in vec2 v_uv;
uniform sampler2D u_nearest;
uniform vec2 u_texSize;      // width, height of nearest
uniform bool u_signed;        // true -> subtract seed radius
uniform sampler2D u_seeds;    // packed 2D texture of seeds [x,y,r]
uniform float u_seedCount;    // number of seeds
uniform vec2 u_seedTexDims;   // seeds texture width, height
out float out_dist;

float sampleSeedRadius(float idNorm) {
    if (idNorm < 0.0) return 0.0;
    // Map normalized id to packed 2D texture coordinates
    float idxNorm = clamp(idNorm, 0.0, 1.0);
    float maxIndex = max(1.0, u_seedCount - 1.0);
    float index = idxNorm * maxIndex;
    float w = u_seedTexDims.x;
    float h = u_seedTexDims.y;
    float x = mod(index, w);
    float y = floor(index / w);
    vec2 uv = vec2((x + 0.5) / w, (y + 0.5) / h);
    return texture(u_seeds, uv).z;
}

void main() {
    vec4 nearest = texture(u_nearest, v_uv);
    if (nearest.z < 0.0) {
        out_dist = 0.0;
        return;
    }
    vec2 dUV = v_uv - nearest.xy;
    vec2 dPx = vec2(dUV.x * u_texSize.x, dUV.y * u_texSize.y);
    float distPx = length(dPx);
    if (u_signed) {
        float r = sampleSeedRadius(nearest.z);
        out_dist = distPx - r;
    } else {
        out_dist = distPx;
    }
}