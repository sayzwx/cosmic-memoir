varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

uniform float uTime;
uniform float uSpin;
uniform float uAccretionRate;
uniform float uTemperature;

void main() {
    vec2 uv = vUv - 0.5;
    float r = length(uv) * 2.0;
    float angle = atan(uv.y, uv.x);

    float rotation = uTime * uSpin * 0.8;
    float spiralCoord = angle + rotation + r * 5.0;

    float turbulence = cm_fbm(vec2(spiralCoord * 2.5, r * 10.0 + uTime * 0.3));
    float fineDetail = cm_fbm(vec2(angle * 4.0 + uTime * 0.5, r * 16.0));
    turbulence = turbulence * 0.7 + fineDetail * 0.3;

    float dopplerFactor = sin(angle + rotation);
    float tempLocal = uTemperature * (1.0 + dopplerFactor * 0.5);
    tempLocal *= (1.0 + turbulence * 0.6);
    tempLocal *= (1.0 / (r + 0.05)) * 1.5;
    tempLocal = clamp(tempLocal, 1000.0, 35000.0);

    vec3 color = cm_colorTemperatureToRGB(tempLocal);

    float blueshift = max(dopplerFactor, 0.0);
    color += vec3(0.08, 0.15, 0.4) * blueshift * (1.0 - r * 0.5);
    float redshift = max(-dopplerFactor, 0.0);
    color += vec3(0.3, 0.05, 0.0) * redshift * (1.0 - r * 0.5);

    float innerEdge = cm_smoothBorder(0.05, 0.2, r);
    float outerEdge = 1.0 - cm_smoothBorder(0.6, 1.0, r);
    float ringMask = innerEdge * outerEdge;

    float brightness = (0.6 + turbulence * 0.4) * uAccretionRate * 3.0;
    float alpha = ringMask * brightness;
    alpha = clamp(alpha, 0.0, 1.0);

    float innerGlow = exp(-r * 4.0) * uAccretionRate * 2.0;
    color += vec3(1.0, 0.9, 0.7) * innerGlow;

    color *= 1.4;

    gl_FragColor = vec4(color, alpha);
}
