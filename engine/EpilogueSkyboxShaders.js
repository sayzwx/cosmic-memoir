export const EPILOGUE_SKY_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const EPILOGUE_SKY_FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uTime, uOpacity, uDrift, uDistortion, uExposure;
  varying vec2 vUv;
  void main() {
    vec2 centered = vUv - 0.5;
    float wave = sin(vUv.y * 18.0 + uTime * 0.055) * uDistortion;
    vec2 drift = vec2(uTime * uDrift + wave, sin(uTime * 0.031) * uDrift * 0.35);
    vec3 base = texture2D(uMap, fract(vUv + drift)).rgb;
    vec3 flow = texture2D(uMap, fract(vUv * vec2(1.006, 0.994) - drift * 0.62)).rgb;
    float nebula = smoothstep(0.12, 0.72, max(flow.r, max(flow.g, flow.b)));
    vec3 violet = vec3(flow.b * 0.18, flow.r * 0.055, flow.r * 0.2);
    vec3 color = mix(base, base + violet, nebula * (0.18 + uDistortion * 8.0));
    color *= 1.0 - dot(centered, centered) * 0.14;
    color = vec3(1.0) - exp(-max(color, 0.0) * uExposure);
    gl_FragColor = vec4(color, uOpacity);
  }
`;

export const EPILOGUE_STAR_VERTEX = `
  attribute float aCollected, aActive, aSize;
  uniform float uTime;
  varying float vCollected, vActive;
  void main() {
    vCollected = aCollected;
    vActive = aActive;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float pulse = 1.0 + aActive * (0.16 + 0.1 * sin(uTime * 2.2));
    gl_PointSize = min(34.0, aSize * pulse * 460.0 / max(1.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;

export const EPILOGUE_STAR_FRAGMENT = `
  uniform float uOpacity;
  varying float vCollected, vActive;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = exp(-d * d * 110.0), glow = exp(-d * d * 14.0);
    float brightness = mix(0.32, 1.0, vCollected) + vActive * 0.45;
    vec3 cold = vec3(0.34, 0.48, 0.82), warm = vec3(1.0, 0.82, 0.48);
    vec3 color = mix(cold, warm, max(vCollected, vActive * 0.7));
    float alpha = (core + glow * 0.52) * brightness * uOpacity;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(mix(color, vec3(1.0), core), alpha);
  }
`;
