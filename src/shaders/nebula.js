import { hashNoise } from './common.js'

export const nebulaVertexShader = /* glsl */ `
  varying vec3 vWorldDir;

  void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const nebulaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uTransitionProgress;
  uniform float uIsTransitioning;

  varying vec3 vWorldDir;

  ${hashNoise}

  float noise3D(vec3 p) {
    float n1 = noise21(p.xy + p.z * 0.37);
    float n2 = noise21(p.yz + p.x * 0.41);
    float n3 = noise21(p.xz + p.y * 0.29);
    return (n1 + n2 + n3) / 3.0;
  }

  float fbm3D(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise3D(p);
      p *= 2.3;
      a *= 0.5;
    }
    return v;
  }

  // High-quality star generation with size variation
  vec4 sampleStars(vec3 dir, float density, float threshold) {
    vec3 p = dir * density;
    vec3 cell = floor(p);
    vec3 f = fract(p);

    float h = hash21(cell.xy + cell.z * 31.17);
    if (h < threshold) return vec4(0.0);

    // Star size: most are small, few are large
    float sizeRoll = hash21(cell.xy * 7.3 + cell.z * 3.1);
    float starSize = mix(0.03, 0.14, pow(sizeRoll, 4.0));

    float d = distance(f, vec3(0.5));
    if (d > starSize) return vec4(0.0);

    float core = 1.0 - smoothstep(0.0, starSize * 0.25, d);
    float halo = 1.0 - smoothstep(0.0, starSize, d);
    halo = pow(halo, 4.0);

    // Star color by temperature
    float colorRoll = hash21(cell.xy * 11.7 + cell.z * 5.9);
    vec3 starColor;
    if (colorRoll < 0.08) {
      starColor = vec3(0.5, 0.65, 1.0);   // Hot blue
    } else if (colorRoll < 0.20) {
      starColor = vec3(0.8, 0.88, 1.0);   // White-blue
    } else if (colorRoll < 0.50) {
      starColor = vec3(1.0, 0.98, 0.92);  // White
    } else if (colorRoll < 0.78) {
      starColor = vec3(1.0, 0.88, 0.65);  // Yellow-white
    } else if (colorRoll < 0.93) {
      starColor = vec3(1.0, 0.72, 0.42);  // Orange
    } else {
      starColor = vec3(1.0, 0.45, 0.25);  // Red
    }

    float brightness = (core * 1.2 + halo * 0.2) * (0.4 + sizeRoll * 0.4);
    return vec4(starColor * brightness, core + halo * 0.3);
  }

  // Diffraction spikes for bright stars
  float diffractionSpikes(vec3 dir, float density) {
    vec3 p = dir * density;
    vec3 cell = floor(p);
    vec3 f = fract(p);

    float h = hash21(cell.xy + cell.z * 31.17);
    float sizeRoll = hash21(cell.xy * 7.3 + cell.z * 3.1);

    // Only bright stars get spikes
    if (h > 0.012 || sizeRoll < 0.85) return 0.0;

    vec2 c = f.xy - 0.5;
    float spike = max(
      smoothstep(0.5, 0.0, abs(c.x)) * smoothstep(0.08, 0.0, abs(c.y)),
      smoothstep(0.5, 0.0, abs(c.y)) * smoothstep(0.08, 0.0, abs(c.x))
    );
    return spike * 0.35;
  }

  void main() {
    vec3 dir = normalize(vWorldDir);
    float slowTime = uTime * 0.008;

    // === Milky Way galactic disk band (side view) ===
    // The disk is tilted - compute band intensity based on direction
    // Tilt the galactic plane ~25 degrees
    vec3 diskNormal = normalize(vec3(0.15, 1.0, 0.2));
    float diskAngle = abs(dot(dir, diskNormal));
    // Sharp disk profile: bright core, fading edges
    float diskBand = exp(-pow(diskAngle * 3.5, 2.0));
    float diskCore = exp(-pow(diskAngle * 12.0, 2.0));

    // === Nebula clouds along the galactic plane ===
    vec3 nebulaP1 = dir * 3.0 + vec3(slowTime, 0.0, slowTime * 0.3);
    float nebula1 = fbm3D(nebulaP1);
    nebula1 = smoothstep(0.38, 0.75, nebula1);

    vec3 nebulaP2 = dir * 6.0 + vec3(slowTime * 0.5, slowTime * 0.8, 0.0);
    float nebula2 = fbm3D(nebulaP2);
    nebula2 = smoothstep(0.42, 0.70, nebula2);

    // Fine structure wisps
    vec3 wispP = dir * 12.0 + vec3(0.0, slowTime * 1.5, slowTime * 0.5);
    float wisps = fbm3D(wispP);
    wisps = smoothstep(0.58, 0.72, wisps) * 0.4;

    // Concentrate nebulae along the disk
    float nebulaMask = nebula1 * 0.55 + nebula2 * 0.45 + wisps * nebula1;
    nebulaMask *= diskBand * 1.3;

    // === Color palette: orange-gold + electric blue, NO purple ===
    // Region variation along the disk
    float colorRegion = fbm3D(dir * 1.8 + vec3(50.0, 30.0, 0.0));
    float colorRegion2 = fbm3D(dir * 3.5 + vec3(0.0, 20.0, 40.0));

    // Orange-gold nebula (#f59e0b -> #fbbf24)
    vec3 colorOrange = vec3(0.96, 0.62, 0.04);
    vec3 colorGold = vec3(1.0, 0.75, 0.14);

    // Electric blue nebula (#3b82f6 -> #60a5fa)
    vec3 colorBlue = vec3(0.12, 0.38, 0.96);
    vec3 colorCyan = vec3(0.25, 0.55, 0.98);

    // Mix: orange dominant in some regions, blue in others
    vec3 nebulaColor = mix(colorBlue, colorOrange, smoothstep(0.3, 0.7, colorRegion));
    nebulaColor = mix(nebulaColor, colorGold, colorRegion2 * 0.4);
    nebulaColor = mix(nebulaColor, colorCyan, smoothstep(0.6, 0.85, colorRegion2) * 0.3);

    // Bright knots - hot star-forming regions
    float knotNoise = fbm3D(dir * 8.0 + vec3(slowTime * 0.3, 0.0, 0.0));
    float knots = pow(smoothstep(0.68, 0.85, knotNoise), 3.0);
    knots *= diskBand;
    nebulaColor += vec3(1.0, 0.85, 0.5) * knots * 0.3;
    nebulaColor += vec3(0.4, 0.6, 1.0) * knots * 0.1;

    // Dark dust lanes - high contrast
    float dust = fbm3D(dir * 5.0 + vec3(slowTime * 0.15, 10.0, 0.0));
    dust = smoothstep(0.52, 0.42, dust);
    float dustMask = dust * nebula1 * diskBand;
    nebulaColor *= mix(1.0, 0.05, dustMask);

    // Galactic core glow - subtle
    float coreGlow = diskCore * (0.4 + nebula1 * 0.3);
    vec3 coreColor = vec3(0.9, 0.7, 0.35);
    nebulaColor += coreColor * coreGlow * 0.4;

    // Final nebula brightness - dim, high contrast
    vec3 nebulaFinal = nebulaColor * nebulaMask * 0.6;

    // === Starfield - dense, clear, with bloom ===
    vec4 starLayer1 = sampleStars(dir, 60.0, 0.965);
    vec4 starLayer2 = sampleStars(dir + vec3(13.7, 5.3, 9.1), 120.0, 0.972);
    vec4 starLayer3 = sampleStars(dir + vec3(27.3, 11.9, 3.7), 200.0, 0.978);
    vec4 starLayer4 = sampleStars(dir + vec3(41.1, 23.7, 17.3), 350.0, 0.984);

    vec3 starColor = starLayer1.rgb + starLayer2.rgb + starLayer3.rgb + starLayer4.rgb;
    float starAlpha = max(max(starLayer1.a, starLayer2.a), max(starLayer3.a, starLayer4.a));

    // Extra bright stars concentrated along the galactic plane
    vec4 diskStars = sampleStars(dir + vec3(7.1, 3.3, 5.7), 90.0, 0.94);
    diskStars.rgb *= diskBand;
    starColor += diskStars.rgb;
    starAlpha = max(starAlpha, diskStars.a * diskBand);

    // Diffraction spikes for the brightest stars
    float spikes1 = diffractionSpikes(dir, 60.0);
    float spikes2 = diffractionSpikes(dir + vec3(13.7, 5.3, 9.1), 120.0);
    starColor += vec3(0.9, 0.95, 1.0) * (spikes1 + spikes2);

    // === Combine ===
    vec3 finalColor = nebulaFinal + starColor;

    // Deep space base - very dark, slight blue-black (#020617)
    finalColor += vec3(0.004, 0.006, 0.012);

    // Off-plane deep field stars (sparse, for dark areas)
    vec4 deepStars = sampleStars(dir + vec3(55.3, 31.7, 19.1), 300.0, 0.992);
    finalColor += deepStars.rgb * 0.6;

    // Warp transition
    if (uIsTransitioning > 0.5) {
      float t = uTransitionProgress;
      finalColor *= 1.0 + t * 1.8;
      // Stars blow out
      finalColor = mix(finalColor, vec3(dot(finalColor, vec3(0.4)), dot(finalColor, vec3(0.5)), dot(finalColor, vec3(0.6))), t * 0.3);
      finalColor = max(finalColor, starColor * (1.0 + t * 3.0));
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`
