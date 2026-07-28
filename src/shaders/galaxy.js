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
  uniform vec3 uMouseWorld;
  uniform float uMousePushStrength;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vStretch;

  void main() {
    vec3 pos = position;

    // Differential rotation: Keplerian - inner stars orbit faster (being pulled in)
    float radius = length(pos.xz);
    float angle = atan(pos.z, pos.x);
    float omega = 0.1 / (1.0 + radius * 0.03);
    angle += omega * uTime;

    pos.x = cos(angle) * radius;
    pos.z = sin(angle) * radius;

    // --- Particle fluidization: mouse push with viscous spring-back ---
    if (uMousePushStrength > 0.001) {
      float distToMouse = distance(pos.xz, uMouseWorld.xz);
      float pushRadius = 14.0;
      if (distToMouse < pushRadius) {
        vec2 pushDir = normalize(pos.xz - uMouseWorld.xz + vec2(0.001));
        float falloff = 1.0 - smoothstep(0.0, pushRadius, distToMouse);
        // Damped oscillation for spring-back feel
        float spring = sin(uTime * 4.0 - distToMouse * 0.4) * 0.3 + 0.7;
        float push = falloff * uMousePushStrength * 2.5 * spring;
        pos.xz += pushDir * push;
        pos.y += push * 0.3;
      }
    }

    // Gravitational wave pulse - expanding ring displacement
    if (uPulseStrength > 0.01) {
      float distToPulse = distance(pos.xz, uPulseOrigin.xz);
      float wave = exp(-pow(distToPulse - uPulseRadius, 2.0) * 0.02) * uPulseStrength;
      pos += normalize(pos + vec3(0.0, 0.001, 0.0)) * wave * 1.5;
      pos.y += wave * 0.3;
    }

    // Mouse parallax: nearby stars move more than distant ones
    float parallaxAmount = 1.0 / (1.0 + radius * 0.03);
    pos.x += uMouseParallax.x * parallaxAmount * 3.0;
    pos.y += uMouseParallax.y * parallaxAmount * 3.0;

    // Focused input brightens nearby stars
    float distToFocus = distance(pos, uFocusPoint);
    float focusBoost = 1.0 + uFocusStrength * exp(-distToFocus * 0.05) * 0.3;

    vStretch = 0.0;

    // Keep the galaxy fixed while the camera flies through it. Collapsing the
    // geometry here creates the false impression that the camera moves back.
    if (uIsTransitioning > 0.5) {
      float t = uTransitionProgress;
      float warpT = smoothstep(0.42, 0.78, t);
      focusBoost *= 1.0 + warpT * 1.8;
      vStretch = warpT;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Twinkle + distance attenuation
    float twinkle = sin(uTime * 1.5 + aOffset + aRandom.x * 6.28) * 0.25 + 0.75;
    float size = aSize * uSize * twinkle * focusBoost;

    if (uIsTransitioning > 0.5) {
      size *= 1.0 + smoothstep(0.35, 0.72, uTransitionProgress) * 0.8;
    }

    gl_PointSize = size / -mvPosition.z;

    vColor = aColor * focusBoost;
    vAlpha = 1.0 - smoothstep(0.68, 0.86, uTransitionProgress) * uIsTransitioning;
  }
`

export const galaxyFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vStretch;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);

    if (dist > 0.5) discard;

    // Sharp star with minimal halo
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = pow(alpha, 1.8);

    // Core blows out to white
    float core = 1.0 - smoothstep(0.0, 0.22, dist);
    vec3 color = mix(vColor, vec3(1.0, 0.98, 0.95), core * 0.45);

    // During warp: stars blow out to pure white
    color = mix(color, vec3(1.0), vStretch * 0.7);
    alpha *= (1.0 + vStretch * 0.5);

    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`
