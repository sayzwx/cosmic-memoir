import { hashNoise, blackbody } from './common.js'

export const accretionDiskVertexShader = /* glsl */ `
  varying vec3 vLocalPos;

  void main() {
    vLocalPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const accretionDiskFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uIsTransitioning;

  varying vec3 vLocalPos;

  ${hashNoise}
  ${blackbody}

  const float INNER_RADIUS = 3.5;
  const float OUTER_RADIUS = 18.0;
  const float THICKNESS = 0.35;

  void main() {
    float angle = atan(vLocalPos.y, vLocalPos.x);
    float radius = length(vLocalPos.xy);

    // Normalize radius across the disk
    float t = clamp((radius - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS), 0.0, 1.0);

    // Keplerian differential rotation: inner edge spins faster
    float orbitalSpeed = sqrt(INNER_RADIUS / radius) * 0.5;
    float rotatedAngle = angle + orbitalSpeed * uTime * 1.8;

    // Turbulence layers at multiple scales
    vec2 noiseUV = vec2(rotatedAngle * 4.0, radius * 0.4);
    float turb1 = fbm21(noiseUV + vec2(uTime * 0.22, 0.0));
    float turb2 = fbm21(noiseUV * 2.4 + vec2(uTime * 0.45, uTime * 0.12));
    float turb3 = fbm21(noiseUV * 5.5 + vec2(uTime * 0.7, 0.0));

    // Temperature profile: 15000K inner -> 3500K outer, modulated by turbulence
    float temp = mix(15000.0, 3500.0, smoothstep(0.0, 1.0, t));
    temp *= (0.55 + turb1 * 0.75 + turb2 * 0.35);

    // Black body emission
    vec3 bbColor = blackbody(temp);

    // Cool tone palette: push toward cobalt blue / pulsar cyan, suppress orange
    bbColor = mix(bbColor, bbColor * vec3(0.32, 0.62, 1.32), 0.48);

    // Subtle purple/cyan tint variation
    vec3 coolTint = mix(vec3(0.2, 0.45, 1.0), vec3(0.45, 0.28, 0.9), turb3);
    bbColor = mix(bbColor, bbColor * coolTint, 0.18);

    // Doppler beaming: approaching side brighter and bluer, receding dimmer and redder
    float dopplerVel = orbitalSpeed * 0.55;
    float dopplerFactor = sin(angle);
    float dopplerBright = pow(max(0.02, 1.0 + dopplerFactor * dopplerVel), 3.0);

    float colorShift = dopplerFactor * dopplerVel * 0.6;
    bbColor.r = max(0.0, bbColor.r * (1.0 - colorShift));
    bbColor.b *= (1.0 + colorShift);
    bbColor *= dopplerBright;

    // Density profile and spiral structure
    float density = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.68, t);
    density *= (0.18 + turb1 * 0.55 + turb2 * 0.42);
    density *= (0.65 + turb3 * 0.55);

    float spiral = sin(rotatedAngle * 2.0 + radius * 0.55) * 0.5 + 0.5;
    density *= (0.45 + spiral * 0.55);

    // Inner edge boost (gravitational blueshift / brighter)
    float innerBoost = smoothstep(0.2, 0.0, t) * 2.5;
    density += innerBoost * turb1;

    float brightness = density * 5.0;

    // Vertical thickness falloff (raymarched disk volume look)
    float verticalFade = 1.0; // ring geometry is already a flat annulus

    vec3 color = bbColor * brightness * verticalFade;

    if (uIsTransitioning > 0.5) {
      color *= (1.0 - uTransitionProgress);
    }

    float alpha = density * 0.92 * verticalFade;
    if (uIsTransitioning > 0.5) {
      alpha *= (1.0 - uTransitionProgress);
    }

    gl_FragColor = vec4(color, alpha);
  }
`
