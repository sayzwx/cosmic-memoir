varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

uniform float uTime;
uniform float uSchwarzschildRadius;
uniform float uScrollProgress;

void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.5);
    vec3 coreBlack = vec3(0.0);
    vec3 gravitationalRedshift = vec3(0.35, 0.04, 0.0) * fresnel * 0.4;
    vec3 result = coreBlack + gravitationalRedshift;
    float horizonFade = smoothstep(0.45, 0.7, uScrollProgress);
    result = mix(result, vec3(0.0), horizonFade);
    gl_FragColor = vec4(result, 1.0);
}
