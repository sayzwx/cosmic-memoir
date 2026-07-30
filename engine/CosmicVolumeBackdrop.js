import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { disposeRenderable, setPosition } from './math.js';

const VERTEX = `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = `
uniform float uTime;
uniform float uIntensity;
varying vec3 vDirection;

float ridge(float value, float width) {
  return 1.0 - smoothstep(0.0, width, abs(value));
}

void main() {
  vec3 d = normalize(vDirection);
  float radial = pow(max(0.0, 1.0 - length(d.xy) * 0.88), 2.2);
  float tunnelA = ridge(sin(d.x * 12.0 + d.z * 5.0 + sin(d.y * 7.0) * 1.7), 0.22);
  float tunnelB = ridge(sin(d.y * 15.0 - d.z * 4.0 + cos(d.x * 9.0) * 1.5), 0.18);
  float fine = ridge(sin((d.x + d.y) * 29.0 + sin(d.z * 11.0)), 0.12);
  float filaments = clamp(tunnelA * 0.45 + tunnelB * 0.38 + fine * 0.12, 0.0, 1.0);
  float drift = 0.92 + 0.08 * sin(uTime * 0.035 + d.x * 8.0 - d.y * 5.0);
  vec3 edge = vec3(0.004, 0.010, 0.025);
  vec3 center = vec3(0.050, 0.130, 0.200);
  vec3 cyan = vec3(0.030, 0.140, 0.180);
  vec3 violet = vec3(0.060, 0.035, 0.100);
  vec3 color = mix(edge, center, radial * 0.72);
  color += cyan * filaments * (0.12 + radial * 0.28);
  color += violet * (1.0 - radial) * tunnelB * 0.11;
  color *= drift * uIntensity;
  gl_FragColor = vec4(color, 1.0);
}`;

export function createCosmicVolumeBackdrop(options = {}) {
  const geometry = new THREE.SphereGeometry(options.radius ?? 150, 48, 32);
  const uniforms = {
    uTime: { value: 0 },
    uIntensity: { value: options.intensity ?? 1 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false
  });
  const object3D = new THREE.Mesh(geometry, material);
  object3D.renderOrder = -100;
  setPosition(object3D, options.position, [0, 0, -18]);
  return {
    object3D,
    drawCalls: 1,
    update(_delta, elapsed) { uniforms.uTime.value = Number.isFinite(elapsed) ? elapsed : uniforms.uTime.value; },
    setIntensity(value = 1) { uniforms.uIntensity.value = Math.max(0, Number(value) || 0); },
    setQuality() {},
    setPixelRatio() {},
    setViewport() {},
    dispose() { disposeRenderable(object3D); }
  };
}
