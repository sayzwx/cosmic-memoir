import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MemoryCarrier, MEMORY_CARRIER_STATES, loadCarrierTexture } from './MemoryCarrier.js';

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const RING_VERTEX = `
  varying vec3 vNormal; varying vec3 vView; varying vec3 vPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosition = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const RING_FRAGMENT = `
  uniform float uTime; uniform float uAlpha; uniform float uDiscovery; uniform float uChromatic;
  varying vec3 vNormal; varying vec3 vView; varying vec3 vPosition;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
    float sweep = sin(7.0 * atan(vPosition.y, vPosition.x) - uTime * 0.32);
    float distortion = sin(vPosition.x * 5.3 + vPosition.y * 3.1 + uTime * 0.24) * 0.5 + 0.5;
    float light = 0.64 + 0.24 * distortion + 0.12 * sweep;
    vec3 cold = mix(vec3(0.08, 0.30, 0.78), vec3(0.78, 0.91, 1.0), light);
    vec3 warm = vec3(1.0, 0.62, 0.29) * fresnel * (0.12 + uDiscovery * 0.12);
    vec3 dispersion = vec3(uChromatic * fresnel, 0.0, -uChromatic * fresnel);
    vec3 color = cold * (0.62 + uDiscovery * 0.58) + warm + dispersion;
    gl_FragColor = vec4(color, uAlpha * (0.68 + fresnel * 0.42));
  }
`;

const IMAGE_VERTEX = `
  uniform float uDiscovery; uniform float uTransform; varying vec2 vUv;
  void main() {
    vUv = uv; vec3 p = position; vec2 centered = uv - 0.5;
    float lens = max(0.0, 1.0 - dot(centered, centered) * 4.0);
    p.z += lens * (0.12 + 0.16 * uDiscovery);
    p.xy *= 1.0 + uTransform * 0.42;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const IMAGE_FRAGMENT = `
  uniform sampler2D uMap; uniform float uTime; uniform float uDiscovery; uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5; float radius = length(p) * 2.0;
    if (radius > 1.0) discard;
    float blur = (1.0 - uDiscovery) * 0.018;
    float bend = (0.055 - uDiscovery * 0.025) * (1.0 - radius);
    vec2 warped = 0.5 + p * (1.0 + bend) + normalize(p + 0.0001) * sin(radius * 12.0 - uTime * 0.18) * blur;
    vec4 center = texture2D(uMap, warped);
    vec4 soft = (texture2D(uMap, warped + vec2(blur, 0.0)) + texture2D(uMap, warped - vec2(blur, 0.0))
      + texture2D(uMap, warped + vec2(0.0, blur)) + texture2D(uMap, warped - vec2(0.0, blur))) * 0.25;
    vec3 color = mix(soft.rgb, center.rgb, 0.25 + uDiscovery * 0.75);
    float feather = 1.0 - smoothstep(0.88, 1.0, radius);
    gl_FragColor = vec4(color, center.a * feather * uAlpha * (0.35 + uDiscovery * 0.65));
  }
`;

const ARC_VERTEX = `
  varying float vFacing;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vFacing = 0.55 + 0.45 * abs(normalize(normalMatrix * normal).z);
    gl_Position = projectionMatrix * view;
  }
`;

const ARC_FRAGMENT = `
  uniform float uTime; uniform float uAlpha; uniform float uPhase; varying float vFacing;
  void main() {
    float shimmer = 0.82 + 0.18 * sin(uTime * 0.55 + uPhase);
    vec3 color = mix(vec3(0.25, 0.55, 1.0), vec3(1.0, 0.72, 0.42), 0.18 + 0.18 * vFacing);
    gl_FragColor = vec4(color * shimmer, uAlpha * vFacing);
  }
`;

const PARTICLE_VERTEX = `
  uniform float uPointSize; uniform float uTransform; attribute float aSeed; varying float vAlpha;
  void main() {
    vec4 view = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * view;
    gl_PointSize = uPointSize * (1.0 + uTransform * aSeed) / max(1.0, -view.z * 0.16);
    vAlpha = 0.35 + 0.65 * aSeed;
  }
`;

const PARTICLE_FRAGMENT = `
  uniform float uAlpha; varying float vAlpha;
  void main() {
    float soft = 1.0 - smoothstep(0.12, 0.5, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(0.62, 0.82, 1.0, soft * vAlpha * uAlpha);
  }
`;

function createFallbackTexture() {
  const pixels = new Uint8Array([
    8, 16, 38, 255, 42, 84, 132, 255,
    29, 49, 83, 255, 174, 194, 215, 255
  ]);
  const texture = new THREE.DataTexture(pixels, 2, 2, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createArcCurve(radius, start, length, z, tilt) {
  const points = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const angle = start + length * t;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * (1 + tilt),
      z + Math.sin(t * Math.PI) * 0.12
    ));
  }
  return new THREE.CatmullRomCurve3(points, false, 'centripetal');
}

export class EinsteinRingMemory extends MemoryCarrier {
  constructor(data = {}, options = {}) {
    super(data, { ...options, carrierType: 'einsteinRing' });
    this.carrierType = 'einsteinRing';
    this.radius = data.radius ?? options.radius ?? 3.15;
    this.tubeRadius = data.tubeRadius ?? options.tubeRadius ?? 0.38;
    this.transformationProgress = 0;
    this._elapsed = 0;
    this._pulsePhase = Math.random() * Math.PI * 2;
    this._worldCenter = new THREE.Vector3();
    this._worldNormal = new THREE.Vector3();
    this._cameraPosition = new THREE.Vector3();
    this._cameraDirection = new THREE.Vector3();
    this._worldQuaternion = new THREE.Quaternion();
    this._arcMeshes = [];
    this._particleOrigins = [];
    this._particleTargets = [];
    this.texture = createFallbackTexture();
    this._buildVisuals();
    this.ready = this._loadMemoryTexture(data.src);
    this.setQuality(this.quality);
    this.setDiscoveryProgress(this.discoveryProgress);
  }

  _buildVisuals() {
    this.visuals = new THREE.Group();
    this.add(this.visuals);
    this.ringUniforms = {
      uTime: { value: 0 }, uAlpha: { value: 0.15 }, uDiscovery: { value: this.discoveryProgress },
      uChromatic: { value: 0.018 }
    };
    const ringGeometry = new THREE.TorusGeometry(this.radius, this.tubeRadius, 20, 144);
    const ringMaterial = new THREE.ShaderMaterial({
      uniforms: this.ringUniforms, vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    this.ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ringMesh.userData.memoryCarrier = this;
    this.visuals.add(this.ringMesh);

    const imageRadius = this.radius - this.tubeRadius * 1.25;
    this.imageUniforms = {
      uMap: { value: this.texture }, uTime: { value: 0 }, uDiscovery: { value: this.discoveryProgress },
      uTransform: { value: 0 }, uAlpha: { value: 0.15 }
    };
    const imageGeometry = new THREE.PlaneGeometry(imageRadius * 2, imageRadius * 2, 24, 24);
    const imageMaterial = new THREE.ShaderMaterial({
      uniforms: this.imageUniforms, vertexShader: IMAGE_VERTEX, fragmentShader: IMAGE_FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide
    });
    this.imageMesh = new THREE.Mesh(imageGeometry, imageMaterial);
    this.imageMesh.position.z = -0.08;
    this.visuals.add(this.imageMesh);
    this._buildArcs();

    this.hitProxy = new THREE.Mesh(
      new THREE.CircleGeometry(this.radius + this.tubeRadius, 32),
      new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    this.hitProxy.userData.memoryCarrier = this;
    this.hitProxy.userData.raycastProxy = 'einsteinRingCenter';
    this.add(this.hitProxy);
    this.hitTargets.push(this.hitProxy, this.ringMesh);
  }

  _buildArcs() {
    const arcSpecs = [
      [-0.25, 1.42, 0.18, 0.03], [2.12, 0.98, -0.12, -0.05],
      [3.72, 1.18, 0.24, 0.08], [5.18, 0.72, -0.2, -0.02]
    ];
    const particlePositions = [];
    const seeds = [];
    arcSpecs.forEach((spec, index) => {
      const curve = createArcCurve(this.radius + this.tubeRadius * (2 + index * 0.34), ...spec);
      const geometry = new THREE.TubeGeometry(curve, 40, 0.045 + index * 0.007, 6, false);
      const uniforms = { uTime: { value: 0 }, uAlpha: { value: 0.11 }, uPhase: { value: index * 1.7 } };
      const material = new THREE.ShaderMaterial({
        uniforms, vertexShader: ARC_VERTEX, fragmentShader: ARC_FRAGMENT,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.secondaryArc = index > 0;
      this._arcMeshes.push(mesh);
      this.visuals.add(mesh);
      curve.getSpacedPoints(15 + index * 3).forEach((point, pointIndex) => {
        particlePositions.push(point.x, point.y, point.z);
        this._particleOrigins.push(point.x, point.y, point.z);
        const targetScale = 0.5 + ((pointIndex * 17 + index * 11) % 23) / 23;
        this._particleTargets.push(point.x * targetScale, point.y * targetScale, 0.3 + index * 0.05);
        seeds.push(0.25 + ((pointIndex * 13 + index * 7) % 17) / 22);
      });
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    this.particleUniforms = { uPointSize: { value: 9 }, uAlpha: { value: 0.12 }, uTransform: { value: 0 } };
    const material = new THREE.ShaderMaterial({
      uniforms: this.particleUniforms, vertexShader: PARTICLE_VERTEX, fragmentShader: PARTICLE_FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.arcParticles = new THREE.Points(geometry, material);
    this.visuals.add(this.arcParticles);
  }

  async _loadMemoryTexture(url) {
    const fallback = this.texture;
    const result = await loadCarrierTexture(url, { fallback, anisotropy: this.quality === 'high' ? 4 : 1 });
    if (this.disposed) {
      if (result.texture && result.texture !== fallback) result.texture.dispose();
      return { ...result, texture: null };
    }
    if (result.texture) {
      this.texture = result.texture;
      this.imageUniforms.uMap.value = result.texture;
      if (result.texture !== fallback) fallback.dispose();
    }
    if (result.error && typeof this.data.onTextureError === 'function') this.data.onTextureError(result.error, this);
    return result;
  }

  setQuality(quality = 'high') {
    super.setQuality(quality);
    if (!this.ringUniforms) return this;
    this.ringUniforms.uChromatic.value = quality === 'high' ? 0.018 : 0;
    this._arcMeshes.forEach((arc, index) => { arc.visible = quality !== 'low' || index === 0; });
    if (this.arcParticles) this.arcParticles.visible = quality !== 'low';
    if (this.texture) {
      this.texture.anisotropy = quality === 'high' ? 4 : 1;
      this.texture.needsUpdate = true;
    }
    return this;
  }

  setDiscoveryProgress(progress = 0) {
    super.setDiscoveryProgress(progress);
    if (!this.ringUniforms) return this;
    this.ringUniforms.uDiscovery.value = this.discoveryProgress;
    this.imageUniforms.uDiscovery.value = this.discoveryProgress;
    return this;
  }

  setTransformationProgress(progress = 0) {
    this.transformationProgress = clamp01(progress);
    if (!this.imageUniforms) return this;
    this.imageUniforms.uTransform.value = this.transformationProgress;
    this.particleUniforms.uTransform.value = this.transformationProgress;
    const positions = this.arcParticles.geometry.attributes.position;
    const t = this.transformationProgress ** 2 * (3 - 2 * this.transformationProgress);
    for (let i = 0; i < positions.count * 3; i += 1) {
      positions.array[i] = this._particleOrigins[i] + (this._particleTargets[i] - this._particleOrigins[i]) * t;
    }
    positions.needsUpdate = true;
    return this;
  }

  setRevealProgress(progress = 0) { return this.setTransformationProgress(progress); }
  setCaptureProgress(progress = 0) { return this.setTransformationProgress(progress); }
  setCaptureAnimationProgress(progress = 0) { return this.setTransformationProgress(progress); }

  setAnimationProgress(progress = {}) {
    if (Number.isFinite(progress)) return this.setTransformationProgress(progress);
    const value = progress.capture ?? progress.reveal ?? progress.transform;
    if (Number.isFinite(value)) this.setTransformationProgress(value);
    return this;
  }

  getDiscoverySample(context = {}) {
    const camera = context.camera;
    this.getWorldPosition(this._worldCenter);
    this.ringMesh.getWorldQuaternion(this._worldQuaternion);
    this._worldNormal.set(0, 0, 1).applyQuaternion(this._worldQuaternion).normalize();
    let distance = Number(context.distance);
    let alignment = Number(context.alignment);
    if (camera?.getWorldPosition) {
      camera.getWorldPosition(this._cameraPosition);
      this._cameraDirection.subVectors(this._worldCenter, this._cameraPosition);
      distance = this._cameraDirection.length();
      if (distance > 0.0001) this._cameraDirection.multiplyScalar(1 / distance);
      alignment = Math.abs(this._cameraDirection.dot(this._worldNormal));
    }
    if (!Number.isFinite(alignment)) alignment = 0;
    if (!Number.isFinite(distance)) distance = Infinity;
    const aimed = Boolean(context.aimed ?? context.isAimed ?? context.focused ?? this.focused);
    const proximityLimit = this.data.discovery?.proximity ?? this.data.discoveryDistance ?? 18;
    const inProximity = Boolean(context.inProximity ?? context.near ?? distance <= proximityLimit);
    const bestView = alignment >= 0.9;
    return {
      type: 'align', interaction: 'align', alignment, aimed, inProximity, bestView,
      active: bestView && aimed && inProximity, requiredSeconds: 3, duration: 3,
      canCapture: this.state === MEMORY_CARRIER_STATES.REVEALED || this.state === MEMORY_CARRIER_STATES.CAPTURED
    };
  }

  update(delta, context = {}) {
    if (this.disposed) return;
    const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
    this._elapsed = Number.isFinite(context.elapsed) ? context.elapsed : this._elapsed + dt;
    const motion = this.reducedMotion ? 0.2 : 1;
    const pulse = 0.92 + Math.sin(this._elapsed * 0.62 + this._pulsePhase) * 0.08 * motion;
    const brightness = 0.15 + this.discoveryProgress * 0.72;
    this.ringUniforms.uTime.value = this._elapsed;
    this.ringUniforms.uAlpha.value = brightness * pulse;
    this.imageUniforms.uTime.value = this._elapsed;
    this.imageUniforms.uAlpha.value = brightness;
    this.particleUniforms.uAlpha.value = (0.12 + this.discoveryProgress * 0.46) * pulse;
    this._arcMeshes.forEach((arc, index) => {
      arc.material.uniforms.uTime.value = this._elapsed;
      arc.material.uniforms.uAlpha.value = (0.1 + this.discoveryProgress * 0.38) * pulse * (1 - index * 0.08);
    });
    this.visuals.rotation.z += dt * 0.018 * motion;
    this.visuals.rotation.x = Math.sin(this._elapsed * 0.18) * 0.012 * motion;
  }

  dispose() {
    if (this.disposed) return;
    const texture = this.texture;
    super.dispose();
    texture?.dispose?.();
    this.texture = null;
    this.ringUniforms = null;
    this.imageUniforms = null;
    this.particleUniforms = null;
    this._arcMeshes.length = 0;
    this._particleOrigins.length = 0;
    this._particleTargets.length = 0;
  }
}
