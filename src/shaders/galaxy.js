export const galaxyVertexShader = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aOffset;
  attribute vec3 aRandom;

  uniform float uTime;
  uniform float uSize;
  uniform float uPulseRadius;
  uniform float uPulseStrength;
  uniform vec3 uPulseOrigin;
  uniform vec2 uMouseParallax;
  uniform vec3 uFocusPoint;
  uniform float uFocusStrength;
  uniform float uTransitionProgress;
  uniform float uIsTransitioning;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Differential rotation: Keplerian angular velocity falloff
    float radius = length(pos.xz);
    float angle = atan(pos.z, pos.x);
    float omega = 0.08 / (1.0 + radius * 0.015);
    angle += omega * uTime;

    pos.x = cos(angle) * radius;
    pos.z = sin(angle) * radius;

    // Gravitational wave pulse - expanding ring displacement
    if (uPulseStrength > 0.01) {
      float distToPulse = distance(pos.xz, uPulseOrigin.xz);
      float wave = exp(-pow(distToPulse - uPulseRadius, 2.0) * 0.02) * uPulseStrength;
      pos += normalize(pos + vec3(0.0, 0.001, 0.0)) * wave * 1.5;
      pos.y += wave * 0.3;
    }

    // Mouse parallax: nearby stars move more than distant ones
    float parallaxAmount = 1.0 / (1.0 + radius * 0.03);
    pos.x += uMouseParallax.x * parallaxAmount * 4.0;
    pos.y += uMouseParallax.y * parallaxAmount * 4.0;

    // Focused input brightens nearby stars
    float distToFocus = distance(pos, uFocusPoint);
    float focusBoost = 1.0 + uFocusStrength * exp(-distToFocus * 0.05) * 0.3;

    // Login success: collapse everything toward singularity
    if (uIsTransitioning > 0.5) {
      pos *= 1.0 - uTransitionProgress * 0.98;
      focusBoost *= 1.0 + uTransitionProgress * 2.0;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Twinkle + distance attenuation
    float twinkle = sin(uTime * 1.5 + aOffset + aRandom.x * 6.28) * 0.25 + 0.75;
    float size = aSize * uSize * twinkle * focusBoost;

    if (uIsTransitioning > 0.5) {
      size *= max(0.05, 1.0 - uTransitionProgress * 0.95);
    }

    gl_PointSize = size / -mvPosition.z;

    vColor = aColor * focusBoost;
    vAlpha = 1.0 - uTransitionProgress * uIsTransitioning;
  }
`

export const galaxyFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);

    if (dist > 0.5) discard;

    // Soft radial falloff: center overexposed, edge fades to background
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = pow(alpha, 1.5);

    // Core blows out to white
    float core = 1.0 - smoothstep(0.0, 0.22, dist);
    vec3 color = mix(vColor, vec3(1.0, 0.98, 0.95), core * 0.45);

    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`
