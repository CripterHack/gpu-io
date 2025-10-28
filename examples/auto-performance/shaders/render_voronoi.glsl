// Render Voronoi cells by candidate ID and optional borders
in vec2 v_uv;
uniform sampler2D u_nearest;
uniform vec2 u_px;          // 1/texSize
uniform bool u_showBorders;
uniform float u_borderAlpha;
out vec4 out_color;

vec3 idToColor(float idNorm) {
    // Hash-based ID color; stable mapping from id
    float t = fract(sin(idNorm * 43758.5453) * 57.5831);
    return vec3(0.6 + 0.4 * sin(6.2831 * t), 0.6 + 0.4 * sin(6.2831 * (t + 0.33)), 0.6 + 0.4 * sin(6.2831 * (t + 0.66)));
}

bool isBorder(vec2 uv) {
    vec4 c = texture(u_nearest, uv);
    if (c.z < 0.0) return false;
    vec4 n = texture(u_nearest, uv + vec2(0.0,  u_px.y));
    vec4 s = texture(u_nearest, uv + vec2(0.0, -u_px.y));
    vec4 e = texture(u_nearest, uv + vec2( u_px.x, 0.0));
    vec4 w = texture(u_nearest, uv + vec2(-u_px.x, 0.0));
    // Border if any neighbor has different normalized id
    return (n.z != c.z) || (s.z != c.z) || (e.z != c.z) || (w.z != c.z);
}

void main() {
    vec4 nearest = texture(u_nearest, v_uv);
    if (nearest.z < 0.0) {
        out_color = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    vec3 baseColor = idToColor(nearest.z);
    float border = (u_showBorders && isBorder(v_uv)) ? 1.0 : 0.0;
    vec3 color = mix(baseColor, vec3(0.0), border);
    float alpha = mix(1.0, u_borderAlpha, border);
    out_color = vec4(color, alpha);
}