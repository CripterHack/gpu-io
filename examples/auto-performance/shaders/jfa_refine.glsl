// JFA refine pass (JFA+): fixed jump = 1 pixel
in vec2 v_uv;
uniform sampler2D u_nearest;
uniform vec2 u_px;
uniform vec2 u_texSize;
uniform float u_emptyId;
out vec4 out_nearest;

float candidateDistPx(vec4 candidate, vec2 uv) {
    if (candidate.z < 0.0) return 1e9;
    vec2 d = (uv - candidate.xy);
    vec2 dPx = vec2(d.x * u_texSize.x, d.y * u_texSize.y);
    return length(dPx);
}

void main() {
    vec4 best = texture(u_nearest, v_uv);
    float bestDist = candidateDistPx(best, v_uv);

    vec2 j = u_px * 1.0;
    vec2 offsets[8];
    offsets[0] = vec2( j.x,  0.0);
    offsets[1] = vec2(-j.x,  0.0);
    offsets[2] = vec2( 0.0,  j.y);
    offsets[3] = vec2( 0.0, -j.y);
    offsets[4] = vec2( j.x,  j.y);
    offsets[5] = vec2( j.x, -j.y);
    offsets[6] = vec2(-j.x,  j.y);
    offsets[7] = vec2(-j.x, -j.y);

    for (int i = 0; i < 8; i++) {
        vec4 cand = texture(u_nearest, v_uv + offsets[i]);
        float d = candidateDistPx(cand, v_uv);
        if (d < bestDist) {
            bestDist = d;
            best = cand;
        }
    }

    if (best.z < 0.0) {
        best = vec4(0.0, 0.0, u_emptyId, 0.0);
    }

    out_nearest = best;
}