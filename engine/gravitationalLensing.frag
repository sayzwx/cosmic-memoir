uniform sampler2D tDiffuse;
uniform float uLensingStrength;
uniform float uSchwarzschildRadius;
uniform float uScrollProgress;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uBlackHoleScreenPos;

varying vec2 vUv;

void main() {
    vec2 center = uBlackHoleScreenPos;
    vec2 uv = vUv;
    vec2 d = uv - center;
    float dist = length(d);

    float lensRadius = uSchwarzschildRadius / uResolution.x;
    float distortion = uLensingStrength * (lensRadius * lensRadius) / (dist * dist + 0.005);
    distortion *= (0.2 + uScrollProgress * 0.8);

    vec2 dir = normalize(d + 0.0001);
    uv -= dir * distortion * 0.15;

    float captureRadius = lensRadius * 0.9;
    if (dist < captureRadius) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    float einsteinRadius = lensRadius * 1.5;
    float ringWidth = 0.004;
    float ring = exp(-pow((dist - einsteinRadius) / ringWidth, 2.0)) * (0.4 + uScrollProgress * 0.6);
    float ringGlow = exp(-pow((dist - einsteinRadius) / (ringWidth * 4.0), 2.0)) * 0.3;

    vec4 color = texture2D(tDiffuse, clamp(uv, 0.0, 1.0));
    color.rgb += vec3(1.0, 0.85, 0.5) * ring * 0.5;
    color.rgb += vec3(0.8, 0.6, 0.3) * ringGlow;

    float vignette = smoothstep(1.3, 0.2, dist * 2.0);
    color.rgb *= mix(1.0, vignette, 0.4 + uScrollProgress * 0.3);

    if (uScrollProgress > 0.5) {
        float fade = smoothstep(0.5, 0.85, uScrollProgress);
        color.rgb *= (1.0 - fade * 0.95);
    }

    float chromaticAberration = distortion * 0.5;
    float r = texture2D(tDiffuse, clamp(uv + dir * chromaticAberration, 0.0, 1.0)).r;
    float b = texture2D(tDiffuse, clamp(uv - dir * chromaticAberration, 0.0, 1.0)).b;
    color.r = mix(color.r, r, 0.3);
    color.b = mix(color.b, b, 0.3);

    gl_FragColor = color;
}
