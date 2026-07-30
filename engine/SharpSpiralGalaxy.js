import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { createRandom, disposeRenderable, setPosition } from './math.js';
import { getQualityBudget } from './qualityBudgets.js';

const TAU = Math.PI * 2;
const ARM_COLORS = [0xd65fa8, 0x8769bf, 0x65c7de, 0x446bba].map(value => new THREE.Color(value));
const CORE_A = new THREE.Color(0xd77949);
const CORE_B = new THREE.Color(0xffd7a0);
const DISK_A = new THREE.Color(0x8e5ac7);
const DISK_B = new THREE.Color(0x4baec9);
const HALO_COLOR = new THREE.Color(0x8495d8);

const STAR_VERTEX = `
attribute vec3 aColor;
attribute float aSize;
attribute float aPhase;
attribute float aTwinkle;
attribute float aShape;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColor;
varying float vShape;
varying float vLight;
void main() {
  float radius = length(position.xy);
  float spin = uTime * (0.010 + 0.030 / (1.0 + radius * 0.32));
  float cs = cos(spin), sn = sin(spin);
  vec3 p = position;
  p.xy = mat2(cs, -sn, sn, cs) * p.xy;
  float twinkle = 1.0 + sin(uTime * (0.65 + aTwinkle * 1.7) + aPhase) * aTwinkle * 0.24;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(aSize * twinkle * uPixelRatio, 1.0, 12.0);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vShape = aShape;
  vLight = twinkle;
}`;

const STAR_FRAGMENT = `
varying vec3 vColor;
varying float vShape;
varying float vLight;
uniform float uIntensity;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float angle = atan(p.y, p.x);
  float radius = length(p);
  float points = mix(4.0, 6.0, step(0.5, vShape));
  float ray = pow(abs(cos(angle * points * 0.5)), 9.0);
  float edge = mix(0.38, 0.96, ray);
  float alpha = 1.0 - smoothstep(edge - 0.055, edge, radius);
  if (alpha <= 0.01) discard;
  gl_FragColor = vec4(vColor * uIntensity * vLight, alpha * min(1.0, uIntensity));
}`;

const DUST_VERTEX = `varying float vAcross;varying float vAlong;
void main(){vAcross=uv.y;vAlong=uv.x;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const DUST_FRAGMENT = `varying float vAcross;varying float vAlong;uniform float uOpacity;
void main(){float center=1.0-smoothstep(.08,.49,abs(vAcross-.5));float ends=smoothstep(0.,.09,vAlong)*(1.0-smoothstep(.86,1.,vAlong));
float grain=.88+.12*cos(vAlong*151.0);float a=center*ends*grain*uOpacity;if(a<.01)discard;gl_FragColor=vec4(.009,.005,.024,a);}`;
const ARM_VERTEX = `attribute vec3 aColor;varying vec3 vColor;varying vec2 vUv;
void main(){vColor=aColor;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const ARM_FRAGMENT = `varying vec3 vColor;varying vec2 vUv;uniform float uOpacity;
void main(){float across=abs(vUv.y-.5)*2.0;float strands=step(.48,fract(vUv.x*93.0+across*7.0));
float edge=1.0-smoothstep(.82,1.0,across);float a=edge*(.16+.12*strands)*uOpacity;
if(a<.01)discard;gl_FragColor=vec4(vColor,a);}`;

function gradientColor(target, t) {
  const scaled = THREE.MathUtils.clamp(t, 0, 0.999) * 3;
  const index = Math.floor(scaled);
  return target.copy(ARM_COLORS[index]).lerp(ARM_COLORS[index + 1], scaled - index);
}

function spiralAngle(arm, normalizedRadius) {
  return arm * TAU / 4 + Math.log1p(normalizedRadius * 8.5) * 2.18;
}

function buildDust(radius) {
  const positions = [], uvs = [], indices = [];
  const steps = 96;
  let vertex = 0;
  for (let arm = 0; arm < 4; arm++) {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const r = radius * (0.105 + t * 0.91);
      const angle = spiralAngle(arm, r / radius) - 0.105;
      const width = radius * (0.014 + t * 0.027);
      const nx = -Math.sin(angle) * width, ny = Math.cos(angle) * width;
      positions.push(Math.cos(angle) * r + nx, Math.sin(angle) * r + ny, radius * 0.012,
        Math.cos(angle) * r - nx, Math.sin(angle) * r - ny, radius * 0.012);
      uvs.push(t, 0, t, 1);
      if (i) indices.push(vertex - 2, vertex - 1, vertex, vertex, vertex - 1, vertex + 1);
      vertex += 2;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function buildArmVeil(radius) {
  const positions = [], colors = [], uvs = [], indices = [], color = new THREE.Color();
  const steps = 128;
  let vertex = 0;
  for (let arm = 0; arm < 4; arm++) {
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1), r = radius * (0.08 + t * 0.96);
      const angle = spiralAngle(arm, r / radius);
      const width = radius * (0.035 + t * 0.095);
      const nx = -Math.sin(angle) * width, ny = Math.cos(angle) * width;
      positions.push(Math.cos(angle) * r + nx, Math.sin(angle) * r + ny, -radius * 0.016,
        Math.cos(angle) * r - nx, Math.sin(angle) * r - ny, -radius * 0.016);
      gradientColor(color, t);
      colors.push(...color.toArray(), ...color.toArray());
      uvs.push(t, 0, t, 1);
      if (i) indices.push(vertex - 2, vertex - 1, vertex, vertex, vertex - 1, vertex + 1);
      vertex += 2;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function buildHalo(radius) {
  const positions = [], segments = 72;
  const addEllipse = (axis, offset, scale) => {
    for (let i = 0; i < segments; i++) {
      const a = i / segments * TAU, b = (i + 1) / segments * TAU;
      const first = [Math.cos(a) * radius, Math.sin(a) * radius * scale, offset];
      const second = [Math.cos(b) * radius, Math.sin(b) * radius * scale, offset];
      if (axis === 1) { [first[1], first[2]] = [first[2], first[1]]; [second[1], second[2]] = [second[2], second[1]]; }
      if (axis === 2) { [first[0], first[2]] = [first[2], first[0]]; [second[0], second[2]] = [second[2], second[0]]; }
      positions.push(...first, ...second);
    }
  };
  [-0.42, 0, 0.42].forEach(value => addEllipse(0, value * radius, Math.sqrt(1 - value * value) * 0.62));
  for (let i = 0; i < 8; i++) addEllipse(i % 2 ? 1 : 2, 0, 0.62);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

export function createSharpSpiralGalaxy(options = {}) {
  const random = createRandom(options.seed ?? 4815);
  const capacity = Math.max(256, Math.floor(options.stars ?? options.capacity ?? 16000));
  const radius = options.radius ?? 190;
  const positions = new Float32Array(capacity * 3), colors = new Float32Array(capacity * 3);
  const sizes = new Float32Array(capacity), phases = new Float32Array(capacity);
  const twinkles = new Float32Array(capacity), shapes = new Float32Array(capacity);
  const color = new THREE.Color();

  for (let i = 0; i < capacity; i++) {
    const bucket = (i * 73) % 100;
    const core = bucket < 18, armStar = bucket >= 18 && bucket < 80, disk = bucket >= 80 && bucket < 94;
    let r, angle, z;
    if (core) {
      r = Math.pow(random(), 2.25) * radius * 0.265;
      angle = random() * TAU;
      z = (random() - 0.5) * radius * (0.035 + 0.055 * (1 - r / (radius * 0.265)));
      color.copy(CORE_A).lerp(CORE_B, 0.25 + random() * 0.75);
    } else if (armStar) {
      const normalized = 0.075 + Math.pow(random(), 0.72) * 0.925;
      r = normalized * radius;
      const arm = i % 4;
      const spread = (0.045 + normalized * 0.16) * ((random() + random() + random()) - 1.5);
      angle = spiralAngle(arm, normalized) + spread;
      z = (random() - 0.5) * radius * (0.014 + normalized * 0.035);
      gradientColor(color, normalized).lerp(ARM_COLORS[(arm + 1) % 4], random() * 0.09);
    } else if (disk) {
      r = Math.sqrt(random()) * radius;
      angle = random() * TAU;
      z = (random() - 0.5) * radius * (0.035 + 0.07 * r / radius);
      color.copy(DISK_A).lerp(DISK_B, r / radius).multiplyScalar(0.48 + random() * 0.25);
    } else {
      r = radius * (0.68 + random() * 0.7);
      angle = random() * TAU;
      z = (random() - 0.5) * radius * 0.72;
      color.copy(HALO_COLOR).multiplyScalar(0.35 + random() * 0.3);
    }
    positions.set([Math.cos(angle) * r, Math.sin(angle) * r, z], i * 3);
    colors.set(color.toArray(), i * 3);
    const bright = random();
    sizes[i] = core && bright > 0.992 ? 6 : bright > 0.93 ? 2.2 + random() * 2.2 : 0.92 + random() * 1.15;
    phases[i] = random() * TAU;
    twinkles[i] = 0.08 + random() * (bright > 0.9 ? 0.82 : 0.3);
    shapes[i] = random() > 0.78 ? 1 : 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkles, 1));
  geometry.setAttribute('aShape', new THREE.BufferAttribute(shapes, 1));
  const starUniforms = { uTime: { value: 0 }, uPixelRatio: { value: 1 }, uIntensity: { value: options.intensity ?? 1 } };
  const stars = new THREE.Points(geometry, new THREE.ShaderMaterial({ uniforms: starUniforms, vertexShader: STAR_VERTEX,
    fragmentShader: STAR_FRAGMENT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  stars.frustumCulled = false;

  const armUniforms = { uOpacity: { value: options.armOpacity ?? 0.82 } };
  const armVeil = new THREE.Mesh(buildArmVeil(radius), new THREE.ShaderMaterial({ uniforms: armUniforms,
    vertexShader: ARM_VERTEX, fragmentShader: ARM_FRAGMENT, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  armVeil.renderOrder = 0;

  const dustUniforms = { uOpacity: { value: options.dustOpacity ?? 0.72 } };
  const dust = new THREE.Mesh(buildDust(radius), new THREE.ShaderMaterial({ uniforms: dustUniforms, vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  dust.renderOrder = 2;
  const haloMaterial = new THREE.LineBasicMaterial({ color: 0x83bfff, transparent: true, opacity: options.haloMinOpacity ?? 0.025,
    depthWrite: false, blending: THREE.AdditiveBlending });
  const halo = new THREE.LineSegments(buildHalo(radius * 3), haloMaterial);
  halo.renderOrder = -1;

  const object3D = new THREE.Group();
  object3D.add(halo, armVeil, stars, dust);
  setPosition(object3D, options.position, [-180, 70, -420]);
  object3D.rotation.set(options.inclination ?? -1.05, options.yaw ?? -0.18, options.roll ?? -0.2);
  const center = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
  let elapsed = 0, manualHaloOpacity = null;
  const api = {
    object3D, stars, dust, halo, armVeil, capacity, drawCalls: 4,
    setQuality(quality = 'high', mobile = false) {
      geometry.setDrawRange(0, Math.min(capacity, getQualityBudget(quality, mobile).galaxy));
      return api;
    },
    setPixelRatio(value = 1) { starUniforms.uPixelRatio.value = THREE.MathUtils.clamp(Number(value) || 1, 0.5, 2); return api; },
    setIntensity(value = 1) { const intensity=Math.max(0,Number(value)||0);starUniforms.uIntensity.value=intensity;armUniforms.uOpacity.value=(options.armOpacity??.82)*intensity;return api; },
    setHaloOpacity(value = 0.08) { manualHaloOpacity = THREE.MathUtils.clamp(Number(value) || 0, 0, 1); haloMaterial.opacity = manualHaloOpacity; return api; },
    update(delta = 0, context = {}) {
      const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
      elapsed += dt;
      starUniforms.uTime.value = elapsed;
      object3D.rotation.z += dt * (options.rotationSpeed ?? 0.012);
      if (manualHaloOpacity === null && context.camera?.getWorldPosition) {
        object3D.getWorldPosition(center); context.camera.getWorldPosition(cameraPosition);
        const near = 1 - THREE.MathUtils.smoothstep(cameraPosition.distanceTo(center), radius * 0.8, radius * 4);
        haloMaterial.opacity = THREE.MathUtils.lerp(options.haloMinOpacity ?? 0.025, options.haloMaxOpacity ?? 0.12, near);
      }
    },
    dispose() { disposeRenderable(stars);disposeRenderable(armVeil);disposeRenderable(dust);disposeRenderable(halo);object3D.removeFromParent();object3D.clear(); }
  };
  api.setQuality(options.quality ?? 'high', options.mobile ?? false);
  api.setPixelRatio(options.pixelRatio ?? 1);
  return api;
}
