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

    // Differential rotation: the inner arms accelerate into a true accretion flow.
    float radius = length(pos.xz);
    float angle = atan(pos.z, pos.x);
    float accretionMask = 1.0 - smoothstep(14.0, 27.0, radius);
    float omega = 0.085 / (1.0 + radius * 0.028) + accretionMask * (0.22 / max(radius, 3.0));
    angle += omega * uTime;

    // The inflow shape is stationary. Only differential rotation and local
    // turbulence evolve, so the inner disk never collapses into a time-made ring.
    float inflow = accretionMask * (0.28 + 0.72 * (1.0 - smoothstep(3.4, 14.0, radius)));
    float radialTurbulence = sin(uTime * (0.75 + aRandom.z) + angle * 6.0) * inflow * 0.16;
    radius = max(3.25, radius + radialTurbulence);

    pos.x = cos(angle) * radius;
    pos.z = sin(angle) * radius;
    pos.y *= 1.0 - accretionMask * 0.72;

    // --- Particle fluidization: mouse push with viscous spring-back ---
    // Material inside the capture zone is gravitationally bound and cannot be
    // pushed away by the cursor interaction used for the outer spiral arms.
    if (uMousePushStrength > 0.001 && radius > 13.0) {
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

    // Twinkle + distance attenuation, with rare bright knots inside spiral arms.
    float twinkle = sin(uTime * 1.5 + aOffset + aRandom.x * 6.28) * 0.25 + 0.75;
    float innerHeat = pow(accretionMask, 2.2) * (1.0 - smoothstep(3.3, 10.0, radius));
    float size = aSize * uSize * twinkle * focusBoost * (1.0 + innerHeat * 1.25);

    if (uIsTransitioning > 0.5) {
      size *= 1.0 + smoothstep(0.35, 0.72, uTransitionProgress) * 0.8;
    }

    gl_PointSize = size / -mvPosition.z;

    float dustLane = smoothstep(0.15, 0.88, sin(angle * 7.0 - radius * 0.62 + aRandom.y * 9.0) * 0.5 + 0.5);
    vec3 accretionColor = mix(vec3(1.0, 0.3, 0.06), vec3(1.0, 0.88, 0.58), smoothstep(0.25, 1.0, innerHeat));
    vColor = mix(aColor * (0.45 + dustLane * 0.68), accretionColor * 1.5, innerHeat) * focusBoost;
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

    // Tight stellar core plus a restrained physical halo.
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = pow(alpha, 2.05);

    // Core blows out to white
    float core = 1.0 - smoothstep(0.0, 0.22, dist);
    vec3 color = mix(vColor, vec3(1.0, 0.98, 0.95), core * 0.58);

    // During warp: stars blow out to pure white
    color = mix(color, vec3(1.0), vStretch * 0.7);
    alpha *= (1.0 + vStretch * 0.5);

    gl_FragColor = vec4(color, alpha * vAlpha);
  }
`
