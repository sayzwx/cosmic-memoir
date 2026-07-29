import { hashNoise, blackbody } from './common.js'

export const accretionDiskVertexShader = /* glsl */ `
  varying vec3 vLocalPos;
  varying vec3 vViewPos;

  void main() {
    vLocalPos = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPos = viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`

export const accretionDiskFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uIsTransitioning;
  uniform float uBreath;
  uniform float uLayer;
  uniform float uOpacity;

  varying vec3 vLocalPos;
  varying vec3 vViewPos;

  ${hashNoise}
  ${blackbody}

  const float INNER_RADIUS = 3.15;
  const float OUTER_RADIUS = 22.0;

  void main() {
    float radius = length(vLocalPos.xy);
    float angle = atan(vLocalPos.y, vLocalPos.x);
    float radial = clamp((radius - INNER_RADIUS) / (OUTER_RADIUS - INNER_RADIUS), 0.0, 1.0);
    float kepler = pow(max(radius / INNER_RADIUS, 1.0), -1.5);
    float flowAngle = angle - uTime * (0.42 + kepler * 1.8);

    // Warped coordinates make the gas look stretched by differential rotation.
    vec2 flow = vec2(flowAngle * 2.8 + radial * 8.0, radial * 13.0);
    float broad = fbm21(flow + vec2(uTime * 0.11, -uTime * 0.05));
    float medium = fbm21(flow * 2.7 + vec2(-uTime * 0.18, uTime * 0.08));
    float fine = fbm21(flow * 7.4 + vec2(uTime * 0.34, 0.0));

    float spiralA = sin(flowAngle * 3.0 + radius * 1.15 + broad * 4.2) * 0.5 + 0.5;
    float spiralB = sin(flowAngle * 7.0 - radius * 0.78 + medium * 3.0) * 0.5 + 0.5;
    float filaments = pow(clamp(spiralA * 0.72 + spiralB * 0.38, 0.0, 1.0), 2.2);
    filaments *= 0.36 + broad * 0.72 + medium * 0.34;

    float innerEdge = exp(-pow((radius - 3.72) * 1.45, 2.0));
    float hotBand = exp(-pow((radius - 5.2) * 0.34, 2.0));
    float outerFade = smoothstep(1.0, 0.62, radial);
    float innerCut = smoothstep(3.16, 3.48, radius);
    float density = innerCut * outerFade * (0.08 + filaments * 0.78 + fine * 0.18);
    density += innerEdge * (0.68 + medium * 0.42);

    // The approaching side is hotter and brighter; the far side is warmer.
    float viewSide = sin(angle + 0.35);
    float doppler = 0.58 + max(viewSide, -0.72) * (0.48 + kepler * 0.3);
    float temperature = mix(3600.0, 11200.0, pow(1.0 - radial, 1.35));
    temperature *= 0.72 + broad * 0.38 + hotBand * 0.34;
    vec3 color = blackbody(temperature);
    vec3 coldShift = vec3(0.42, 0.7, 1.34);
    vec3 warmShift = vec3(1.24, 0.68, 0.28);
    color *= mix(warmShift, coldShift, smoothstep(-0.45, 0.72, viewSide));
    color *= max(0.2, doppler * doppler);

    // Lensed layers are thin, pale echoes above and below the horizon.
    if (uLayer > 0.5) {
      density *= 0.42 + innerEdge * 1.5;
      color = mix(color, vec3(0.58, 0.8, 1.25), 0.28);
      color *= 1.18;
    }

    float flicker = 0.9 + sin(uTime * 1.3 + angle * 9.0 + fine * 4.0) * 0.1;
    color *= density * (1.4 + innerEdge * 2.8) * flicker * (0.9 + uBreath * 0.16);
    float alpha = clamp(density * uOpacity, 0.0, 0.98);

    if (uIsTransitioning > 0.5) {
      float approach = smoothstep(0.18, 0.68, uTransitionProgress);
      color *= 1.0 + approach * 2.4;
      alpha *= 1.0 - smoothstep(0.68, 0.84, uTransitionProgress);
    }

    gl_FragColor = vec4(color, alpha);
  }
`
