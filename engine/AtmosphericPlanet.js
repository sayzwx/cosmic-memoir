import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget } from './qualityBudgets.js';
import { setPosition } from './math.js';

// ── Shared vertex shader ──────────────────────────────────────────────────────
const VERTEX = `
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vLocal = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// ── 3D hash-based noise with FBM (4 + 6 octave variants) ─────────────────────
const NOISE = `
  float hash(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(hash(i),                 hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)),   hash(i + vec3(1,1,0)), f.x),
        f.y
      ),
      mix(
        mix(hash(i + vec3(0,0,1)),   hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)),   hash(i + vec3(1,1,1)), f.x),
        f.y
      ),
      f.z
    );
  }

  float fbm(vec3 p) {
    float n = 0.0, a = 0.5;
    vec3 warp = vec3(0.0);
    for (int i = 0; i < 4; i++) {
      n += noise(p + warp) * a;
      warp += p * 0.15 + 2.3;
      p = p * 2.13 + 3.1;
      a *= 0.48;
    }
    return n;
  }

  float fbmHigh(vec3 p) {
    float n = 0.0, a = 0.65;
    vec3 warp = vec3(0.0);
    for (int i = 0; i < 6; i++) {
      n += noise(p + warp) * a;
      warp += p * 0.12 + 1.7;
      p = p * 2.37 + 4.2;
      a *= 0.45;
    }
    return n;
  }
`;

// ── Surface shader: oceans, landmasses, ice caps ─────────────────────────────
const SURFACE = `${NOISE}
  uniform float uTime;
  uniform float uDetail;
  uniform vec3 uOcean;
  uniform vec3 uOceanShallow;
  uniform vec3 uLand;
  uniform vec3 uLandHigh;
  uniform vec3 uIce;

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;

  const vec3 LIGHT_DIR = vec3(-0.419058, 0.349215, 0.838116);

  float fresnel(vec3 view, vec3 normal, float power) {
    return pow(1.0 - max(dot(view, normal), 0.0), power);
  }

  void main() {
    vec3 p = normalize(vLocal);

    // ── terrain height via 6-octave FBM ──
    float detailScale = mix(3.5, 7.0, uDetail);
    vec3 coord = p * detailScale + vec3(uTime * 0.005, uTime * 0.002, uTime * 0.001);
    float terrain = fbmHigh(coord);

    // ── latitude factor (y = pole) ──
    float lat = abs(p.y);

    // ── continental mask (large-scale land/ocean) ──
    vec3 continentCoord = p * 2.2 + vec3(11.3, 7.7, 3.1);
    float continent = fbm(continentCoord);
    float landMask = smoothstep(0.42, 0.62, continent);

    // ── blend extra detail into terrain ──
    float detailNoise = fbm(p * 12.0 + vec3(uTime * 0.001));
    float fineTerrain = terrain * 0.7 + detailNoise * 0.3;

    // ── shoreline foam ──
    float shoreline = smoothstep(0.38, 0.48, fineTerrain) * (1.0 - smoothstep(0.48, 0.58, fineTerrain));
    shoreline *= landMask;

    // ── classify terrain ──
    float oceanFloor = 1.0 - landMask;
    float shallowWater = oceanFloor * smoothstep(0.35, 0.43, fineTerrain);
    float deepWater = oceanFloor * (1.0 - shallowWater);

    float lowLand = landMask * smoothstep(0.42, 0.55, fineTerrain) * (1.0 - smoothstep(0.55, 0.70, fineTerrain));
    float highLand = landMask * smoothstep(0.55, 0.70, fineTerrain);
    float mountain = landMask * smoothstep(0.70, 0.90, fineTerrain);

    // ── ice caps on poles + high mountains ──
    float iceMask = smoothstep(0.75, 0.95, lat);
    iceMask = max(iceMask, mountain * 0.6 * smoothstep(0.75, 0.95, lat + 0.15));

    // ── base color from terrain classification ──
    vec3 color = uOcean;
    color = mix(color, uOceanShallow, shallowWater * 0.8);
    color = mix(color, uLand * (0.75 + fineTerrain * 0.5), lowLand);
    color = mix(color, uLandHigh * (0.65 + fineTerrain * 0.6), highLand);
    color = mix(color, uLandHigh * (0.8 + fineTerrain * 0.4), mountain);

    vec3 foamColor = vec3(0.65, 0.72, 0.68);
    color = mix(color, foamColor, shoreline * 0.5);
    color = mix(color, uIce, iceMask * 0.85);

    // ── micro detail variation ──
    float micro = fbm(p * 25.0 + 17.3);
    color += (micro - 0.5) * 0.04;

    // ── lighting ──
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    float NdotL = max(dot(N, LIGHT_DIR), 0.0);
    float ambient = 0.08;
    float diffuse = NdotL * 0.92;

    // ── hemisphere light ──
    float hemiTop = 0.5 + 0.5 * N.y;
    float hemiBot = 0.5 - 0.5 * N.y;
    vec3 hemiColor = vec3(0.15, 0.18, 0.25) * hemiTop + vec3(0.04, 0.03, 0.02) * hemiBot;

    // ── specular on water ──
    vec3 H = normalize(LIGHT_DIR + V);
    float spec = pow(max(dot(N, H), 0.0), 64.0);
    float waterMask = deepWater + shallowWater * 0.6;
    float specularHighlight = spec * waterMask * 0.7;

    // ── specular on ice ──
    float iceSpec = pow(max(dot(N, H), 0.0), 128.0) * iceMask * 0.4;

    // ── rim lighting ──
    float rimLight = fresnel(V, N, 2.5) * (1.0 - waterMask * 0.5) * 0.15;

    // ── compose ──
    vec3 lit = color * (ambient + diffuse) + color * hemiColor;
    lit += specularHighlight * vec3(0.4, 0.65, 1.0) * 1.2;
    lit += iceSpec * vec3(0.8, 0.9, 1.0);
    lit += rimLight * vec3(0.3, 0.5, 0.9);

    gl_FragColor = vec4(lit, 1.0);
  }
`;

// ── Cloud shader: volumetric animated cloud layer ────────────────────────────
const CLOUDS = `${NOISE}
  uniform float uTime;
  uniform float uDetail;

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying vec3 vView;

  const vec3 LIGHT_DIR = vec3(-0.419058, 0.349215, 0.838116);
  const vec3 CLOUD_COLOR = vec3(0.88, 0.92, 0.98);
  const vec3 CLOUD_SUNSET = vec3(1.0, 0.65, 0.35);

  float fresnel(vec3 view, vec3 normal, float power) {
    return pow(1.0 - max(dot(view, normal), 0.0), power);
  }

  void main() {
    vec3 p = normalize(vLocal);

    // ── two cloud layers with different scales and speeds ──
    float detailScale = mix(3.5, 6.5, uDetail);
    vec2 speed1 = vec2(uTime * 0.018, uTime * 0.006);
    vec2 speed2 = vec2(uTime * -0.009, uTime * 0.014);

    // layer 1: large sweeping bands
    vec3 coord1 = p * detailScale + vec3(speed1, 0.0);
    float cloud1 = fbm(coord1);

    // layer 2: finer detail, opposite drift
    vec3 coord2 = p * (detailScale * 1.8) + vec3(speed2, uTime * 0.003);
    float cloud2 = fbm(coord2);

    // layer 3: wispy high-altitude streaks
    vec3 coord3 = p * (detailScale * 3.5) + vec3(uTime * 0.025, uTime * 0.010, uTime * 0.005);
    float cloud3 = noise(coord3);

    // ── combine layers ──
    float cloud = cloud1 * 0.55 + cloud2 * 0.30 + cloud3 * 0.15;
    cloud = smoothstep(0.35, 0.75, cloud);

    // ── density mask: fewer clouds at poles ──
    float lat = abs(p.y);
    float latMask = 1.0 - smoothstep(0.6, 0.95, lat);
    latMask *= 1.0 - smoothstep(0.0, 0.15, lat) * 0.3;
    cloud *= latMask;

    // ── alpha with soft falloff ──
    float alpha = cloud * 0.65;
    alpha *= 0.6 + 0.4 * (cloud1 * 0.5 + 0.5);

    if (alpha < 0.012) discard;

    // ── lighting ──
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);
    float NdotL = max(dot(N, LIGHT_DIR), 0.0);
    float light = 0.35 + 0.65 * NdotL;
    light *= 0.85 + 0.15 * cloud;

    // ── sunset coloring on terminator ──
    float terminator = 1.0 - smoothstep(0.0, 0.3, NdotL);
    vec3 baseColor = mix(CLOUD_COLOR, CLOUD_SUNSET, terminator * 0.6);

    // ── ambient occlusion ──
    float ao = 0.7 + 0.3 * (1.0 - cloud);

    // ── rim glow on cloud edges ──
    float rim = fresnel(V, N, 2.0) * 0.3;

    vec3 finalColor = baseColor * light * ao + rim * vec3(0.6, 0.7, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// ── Rim shader: Rayleigh scattering atmosphere glow ──────────────────────────
const RIM = `
  uniform vec3 uRimColor;
  uniform float uIntensity;
  uniform float uDensity;

  varying vec3 vNormal;
  varying vec3 vView;

  const vec3 LIGHT_DIR = vec3(-0.419058, 0.349215, 0.838116);

  float rayleighPhase(float cosTheta) {
    return (3.0 / (16.0 * 3.14159265)) * (1.0 + cosTheta * cosTheta);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vView);

    // ── Fresnel rim: strong at grazing angles ──
    float rim = 1.0 - max(dot(N, V), 0.0);

    // ── double rim: inner and outer glow ──
    float innerRim = pow(rim, 1.6) * 0.3;
    float outerRim = pow(rim, 4.5) * 1.8;

    // ── Rayleigh scattering factor ──
    float opticalDepth = pow(rim, 1.2) * uDensity;
    float scattering = 1.0 - exp(-opticalDepth * 3.0);

    // ── sun-facing rim is brighter ──
    float NdotL = max(dot(N, LIGHT_DIR), 0.0);
    float sunFactor = 0.3 + 0.7 * pow(max(NdotL, 0.0), 0.8);

    // ── phase function makes sun-facing side glow more ──
    float cosTheta = dot(V, LIGHT_DIR);
    float phase = rayleighPhase(cosTheta);

    // ── composite rim glow ──
    float glow = (innerRim + outerRim) * scattering * uIntensity * sunFactor;
    glow *= 0.6 + 0.4 * phase * 3.0;

    // ── color: blue scattering, warmer on terminator ──
    float warmFactor = smoothstep(-0.1, 0.3, NdotL);
    vec3 warmTint = vec3(1.0, 0.5, 0.2);
    vec3 color = mix(uRimColor, warmTint, (1.0 - warmFactor) * 0.3);

    // ── soft outer halo ──
    float halo = pow(rim, 8.0) * 0.4 * uIntensity;

    float totalAlpha = glow + halo;
    totalAlpha = clamp(totalAlpha, 0.0, 1.0);

    gl_FragColor = vec4(color * (glow + halo) * 1.5, totalAlpha * 0.7);
  }
`;

// ── Planet construction ───────────────────────────────────────────────────────

export function createAtmosphericPlanet(options = {}) {
  const budget = getQualityBudget(options.quality, options.mobile);

  // ── geometry ──
  const segs = budget.planetSegments;
  const geometry = new THREE.SphereGeometry(
    options.radius || 175,
    segs,
    Math.round(segs * 0.65)
  );

  // ── shared uniforms ──
  const common = {
    uTime: { value: 0 },
    uDetail: { value: budget.quality === 'low' ? 0 : 1 }
  };

  // ── surface material ──
  const surfaceUniforms = {
    ...common,
    uOcean: { value: new THREE.Color(options.oceanColor || 0x061a35) },
    uOceanShallow: { value: new THREE.Color(options.oceanShallowColor || 0x0a3a5a) },
    uLand: { value: new THREE.Color(options.landColor || 0x465f59) },
    uLandHigh: { value: new THREE.Color(options.landHighColor || 0x7a8a7a) },
    uIce: { value: new THREE.Color(options.iceColor || 0xc8dce8) }
  };
  const surfaceMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: SURFACE,
    uniforms: surfaceUniforms
  });

  // ── cloud material ──
  const cloudMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: CLOUDS,
    uniforms: {
      uTime: common.uTime,
      uDetail: common.uDetail
    },
    transparent: true,
    depthWrite: false
  });

  // ── rim / atmosphere material ──
  const rimMaterial = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: RIM,
    uniforms: {
      uRimColor: { value: new THREE.Color(options.rimColor || 0x4488ff) },
      uIntensity: { value: options.rimIntensity ?? 1.2 },
      uDensity: { value: options.rimDensity ?? 1.0 }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide
  });

  // ── build scene ──
  const object3D = new THREE.Group();
  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  const clouds = new THREE.Mesh(geometry, cloudMaterial);
  const rim = new THREE.Mesh(geometry, rimMaterial);

  // scaling: clouds sit above surface, rim is the outermost atmosphere shell
  clouds.scale.setScalar(1.015);
  rim.scale.setScalar(1.07);

  object3D.add(surface, clouds, rim);
  setPosition(object3D, options.position, [285, -205, -40]);
  object3D.rotation.z = options.axialTilt ?? -0.22;
  let elapsedTime = 0;

  // ── public API ──
  const api = {
    object3D,
    surface,
    clouds,
    rim,
    drawCalls: 3,

    update(delta, context = {}) {
      const dt = Math.max(0, Number(delta) || 0);
      elapsedTime = Number.isFinite(context.elapsed) ? context.elapsed : elapsedTime + dt;
      common.uTime.value = elapsedTime;
      surface.rotation.y += dt * (options.rotationSpeed ?? 0.018);
      clouds.rotation.y += dt * (options.cloudSpeed ?? 0.026);
    },

    setQuality(quality) {
      const name = getQualityBudget(quality).quality;
      common.uDetail.value = name === 'low' ? 0 : (name === 'medium' ? 0.55 : 1);
      clouds.visible = name !== 'low' || options.keepCloudsOnLow === true;
    },

    dispose() {
      object3D.removeFromParent();
      geometry.dispose();
      surfaceMaterial.dispose();
      cloudMaterial.dispose();
      rimMaterial.dispose();
    }
  };

  api.setQuality(options.quality);
  return api;
}
