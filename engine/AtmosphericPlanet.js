import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { getQualityBudget } from './qualityBudgets.js';
import { setPosition } from './math.js';

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

const NOISE = `
  float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y), mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float n=0.0, a=0.5; for(int i=0;i<4;i++){ n+=noise(p)*a; p=p*2.03+3.1; a*=0.5; } return n; }
`;

const SURFACE = `${NOISE}
  uniform float uTime;
  uniform float uDetail;
  uniform vec3 uOcean;
  uniform vec3 uLand;
  varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec3 p = normalize(vLocal);
    float terrain = fbm(p * mix(2.8, 5.2, uDetail) + vec3(uTime * 0.006, 0.0, 0.0));
    float landMask = smoothstep(0.49, 0.58, terrain);
    float ice = smoothstep(0.72, 0.9, abs(p.y));
    vec3 base = mix(uOcean, uLand * (0.72 + terrain * 0.55), landMask);
    base = mix(base, vec3(0.72,0.83,0.9), ice * 0.72);
    float light = max(dot(normalize(vNormal), normalize(vec3(-0.42,0.35,0.84))), 0.0);
    float oceanSpec = pow(max(dot(reflect(normalize(vec3(0.42,-0.35,-0.84)), vNormal), vView), 0.0), 42.0) * (1.0-landMask);
    gl_FragColor = vec4(base * (0.08 + light * 0.95) + oceanSpec * vec3(0.5,0.72,1.0), 1.0);
  }
`;

const CLOUDS = `${NOISE}
  uniform float uTime; uniform float uDetail;
  varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;
  void main() {
    vec3 p = normalize(vLocal);
    float cloud = fbm(p * mix(4.0, 7.0, uDetail) + vec3(uTime * 0.025, 0.0, uTime * 0.008));
    float alpha = smoothstep(0.58, 0.7, cloud) * 0.72;
    float light = 0.25 + 0.75 * max(dot(vNormal, normalize(vec3(-0.42,0.35,0.84))), 0.0);
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vec3(0.74,0.84,0.96) * light, alpha);
  }
`;

const RIM = `
  varying vec3 vNormal; varying vec3 vView;
  void main() {
    float rim = pow(1.0 - max(dot(normalize(vNormal), normalize(vView)), 0.0), 3.2);
    gl_FragColor = vec4(vec3(0.18,0.48,1.0) * rim * 1.5, rim * 0.56);
  }
`;

export function createAtmosphericPlanet(options = {}) {
  const budget = getQualityBudget(options.quality, options.mobile);
  const geometry = new THREE.SphereGeometry(options.radius || 175, budget.planetSegments, Math.round(budget.planetSegments * 0.65));
  const common = { uTime: { value: 0 }, uDetail: { value: budget.quality === 'low' ? 0 : 1 } };
  const surfaceMaterial = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: SURFACE, uniforms: {
    ...common, uOcean: { value: new THREE.Color(options.oceanColor || 0x061a35) },
    uLand: { value: new THREE.Color(options.landColor || 0x465f59) }
  }});
  const cloudMaterial = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: CLOUDS,
    uniforms: { uTime: common.uTime, uDetail: common.uDetail }, transparent: true, depthWrite: false });
  const rimMaterial = new THREE.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: RIM,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const object3D = new THREE.Group();
  const surface = new THREE.Mesh(geometry, surfaceMaterial);
  const clouds = new THREE.Mesh(geometry, cloudMaterial);
  const rim = new THREE.Mesh(geometry, rimMaterial);
  clouds.scale.setScalar(1.012);
  rim.scale.setScalar(1.065);
  object3D.add(surface, clouds, rim);
  setPosition(object3D, options.position, [285, -205, -40]);
  object3D.rotation.z = options.axialTilt ?? -0.22;
  const api = {
    object3D, surface, clouds, rim, drawCalls: 3,
    update(delta, elapsed) {
      common.uTime.value = elapsed;
      surface.rotation.y += delta * (options.rotationSpeed ?? 0.018);
      clouds.rotation.y += delta * (options.cloudSpeed ?? 0.026);
    },
    setQuality(quality) {
      const name = getQualityBudget(quality).quality;
      common.uDetail.value = name === 'low' ? 0 : (name === 'medium' ? 0.55 : 1);
      clouds.visible = name !== 'low' || options.keepCloudsOnLow === true;
    },
    dispose() {
      object3D.removeFromParent();
      geometry.dispose(); surfaceMaterial.dispose(); cloudMaterial.dispose(); rimMaterial.dispose();
    }
  };
  api.setQuality(options.quality);
  return api;
}
