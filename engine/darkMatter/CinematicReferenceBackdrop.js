import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { disposeRenderable, setPosition } from './math.js';

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uMotion;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    vec2 centeredUv = vUv - 0.5;
    float drift = uTime * 0.006 * uMotion;
    vec2 sampleUv = vUv;
    sampleUv.x += sin(vUv.y * 7.0 + drift) * 0.0025 * uMotion;
    sampleUv.y += cos(vUv.x * 6.0 + drift * 0.7) * 0.0018 * uMotion;

    vec3 plate = texture2D(uMap, sampleUv).rgb;
    float warmField = smoothstep(-0.62, 0.58, centeredUv.x - centeredUv.y * 0.20);
    vec3 purpleGrade = vec3(0.44, 0.27, 0.67);
    vec3 goldGrade = vec3(0.94, 0.58, 0.25);
    plate = mix(plate * purpleGrade, plate * goldGrade, warmField * 0.22);
    float luminanceDrift = mix(0.5, sin(uTime * 0.12 + centeredUv.x * 3.0), uMotion);
    plate *= 0.68 + 0.10 * luminanceDrift;

    float vignette = 1.0 - smoothstep(0.23, 0.78, length(centeredUv * vec2(1.10, 0.94)));
    float edgeFade = smoothstep(0.0, 0.10, vUv.x) * smoothstep(0.0, 0.10, 1.0 - vUv.x)
      * smoothstep(0.0, 0.13, vUv.y) * smoothstep(0.0, 0.13, 1.0 - vUv.y);
    float alpha = uOpacity * vignette * edgeFade;
    gl_FragColor = vec4(plate, alpha);
  }
`;

function createFallbackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  const base = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  base.addColorStop(0, '#05030e');
  base.addColorStop(0.38, '#21103b');
  base.addColorStop(0.7, '#3f1d38');
  base.addColorStop(1, '#080511');
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const bloom = context.createRadialGradient(740, 210, 10, 740, 210, 480);
  bloom.addColorStop(0, 'rgba(222, 153, 66, 0.72)');
  bloom.addColorStop(0.25, 'rgba(128, 67, 95, 0.30)');
  bloom.addColorStop(1, 'rgba(16, 6, 35, 0)');
  context.fillStyle = bloom;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCinematicReferenceBackdrop(options = {}) {
  const fallbackTexture = createFallbackTexture();
  let activeTexture = fallbackTexture;
  let loadingTexture = null;
  let disposed = false;
  const initialQuality = typeof options.quality === 'string' ? options.quality : options.quality?.quality;
  const initialOpacityScale = initialQuality === 'low' ? 0.55 : initialQuality === 'medium' ? 0.78 : 1;
  let qualityMotion = initialQuality === 'low' ? 0 : initialQuality === 'medium' ? 0.45 : 1;
  let reducedMotion = Boolean(options.reducedMotion);
  const baseOpacity = options.opacity ?? 0.46;
  const disposedTextures = new WeakSet();
  const disposeTexture = (texture) => {
    if (!texture || disposedTextures.has(texture)) return;
    disposedTextures.add(texture);
    texture.dispose();
  };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: fallbackTexture },
      uTime: { value: 0 },
      uMotion: { value: reducedMotion ? 0 : qualityMotion },
      uOpacity: { value: baseOpacity * initialOpacityScale }
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: false
  });
  const size = options.size || [114, 72];
  const object3D = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  object3D.name = options.name || 'M8CinematicReferenceBackdrop';
  object3D.renderOrder = -10;
  setPosition(object3D, options.position, [0, 1, -82]);
  const baseY = object3D.position.y;

  const loader = new THREE.TextureLoader();
  loadingTexture = loader.load(
    options.src || './OIP-C (1).webp',
    (texture) => {
      if (disposed) {
        disposeTexture(texture);
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      disposeTexture(activeTexture);
      activeTexture = texture;
      loadingTexture = null;
      material.uniforms.uMap.value = texture;
      material.needsUpdate = true;
    },
    undefined,
    () => {
      disposeTexture(loadingTexture);
      loadingTexture = null;
    }
  );

  return {
    object3D,
    drawCalls: 1,
    update(_delta, elapsed) {
      if (disposed) return;
      const time = Number.isFinite(elapsed) ? elapsed : material.uniforms.uTime.value;
      material.uniforms.uTime.value = time;
      const motion = material.uniforms.uMotion.value;
      object3D.position.y = baseY + Math.sin(time * 0.08) * 0.00012 * motion;
      object3D.rotation.z = Math.sin(time * 0.035) * 0.0015 * motion;
    },
    setQuality(quality) {
      if (disposed) return;
      const level = typeof quality === 'string' ? quality : quality?.quality;
      const opacityScale = level === 'low' ? 0.55 : level === 'medium' ? 0.78 : 1;
      qualityMotion = level === 'low' ? 0 : level === 'medium' ? 0.45 : 1;
      material.uniforms.uOpacity.value = baseOpacity * opacityScale;
      material.uniforms.uMotion.value = reducedMotion ? 0 : qualityMotion;
      object3D.visible = opacityScale > 0;
    },
    setReducedMotion(value) {
      if (disposed) return;
      reducedMotion = Boolean(value);
      material.uniforms.uMotion.value = reducedMotion ? 0 : qualityMotion;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      disposeRenderable(object3D);
      const textures = new Set([fallbackTexture, activeTexture, loadingTexture]);
      for (const texture of textures) disposeTexture(texture);
      loadingTexture = null;
    }
  };
}
