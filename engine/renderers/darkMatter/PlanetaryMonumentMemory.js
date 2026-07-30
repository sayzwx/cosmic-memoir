import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { MemoryCarrier, loadCarrierTexture } from './MemoryCarrier.js';
import { createAtmosphericPlanet } from './AtmosphericPlanet.js';

const clamp01 = value => THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
const PHOTO_VERTEX = `
  varying vec2 vUv;
  uniform float uCurve;
  void main() {
    vUv = uv;
    vec3 p = position;
    float x = uv.x * 2.0 - 1.0;
    p.z += (1.0 - x * x) * uCurve;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const PHOTO_FRAGMENT = `
  uniform sampler2D uMap;
  uniform vec3 uGlowColor;
  uniform float uReveal;
  uniform float uPulse;
  varying vec2 vUv;
  void main() {
    vec2 edge = smoothstep(vec2(0.0), vec2(0.12), vUv) *
      smoothstep(vec2(0.0), vec2(0.12), 1.0 - vUv);
    float feather = edge.x * edge.y;
    vec4 photo = texture2D(uMap, vUv);
    float revealMask = smoothstep(1.0 - uReveal - 0.18, 1.0 - uReveal + 0.12,
      vUv.y + sin(vUv.x * 13.0) * 0.018);
    float luminance = dot(photo.rgb, vec3(0.299, 0.587, 0.114));
    float alpha = feather * revealMask * (0.16 + uReveal * 0.84);
    vec3 color = photo.rgb * (0.38 + uReveal * 0.78);
    color += uGlowColor * (0.08 + luminance * 0.12) * uPulse;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;
const GLOW_VERTEX = `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const GLOW_FRAGMENT = `
  uniform float uReveal; uniform float uPulse; uniform vec3 uColor; varying vec2 vUv;
  void main(){
    vec2 p=vUv*2.0-1.0; float r=length(p);
    float broken=sin(atan(p.y,p.x)*9.0+r*18.0)*0.035;
    float a=(1.0-smoothstep(0.12,1.0+broken,r))*(0.06+uReveal*0.3)*uPulse;
    if(a<0.004)discard; gl_FragColor=vec4(uColor*a*1.8,a);
  }
`;

function vectorFrom(value, fallback) {
  if (value?.isVector3) return value.clone();
  if (Array.isArray(value)) return new THREE.Vector3().fromArray(value);
  if (value && typeof value === 'object') return new THREE.Vector3(value.x || 0, value.y || 0, value.z || 0);
  return fallback.clone();
}

function createFallbackTexture() {
  const pixels = new Uint8Array([24, 34, 48, 255, 69, 82, 91, 255, 52, 43, 47, 255, 112, 91, 71, 255]);
  const texture = new THREE.DataTexture(pixels, 2, 2, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function curveDisc(geometry, planetRadius, lift) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const sag = Math.sqrt(Math.max(0, planetRadius * planetRadius - x * x - y * y)) - planetRadius;
    position.setZ(i, sag + lift);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export class PlanetaryMonumentMemory extends MemoryCarrier {
  constructor(data = {}, options = {}) {
    super({ ...data, carrier: 'planetaryMonument' }, { ...options, carrierType: 'planetaryMonument' });
    this.carrierType = 'planetaryMonument';
    this.radius = THREE.MathUtils.clamp(data.radius ?? options.radius ?? 10, 1, 1000);
    this.position.copy(vectorFrom(data.position ?? options.position, new THREE.Vector3(18, -8, -16)));
    this._elapsed = 0;
    this._cameraQuaternion = new THREE.Quaternion();
    this._parentQuaternion = new THREE.Quaternion();
    this._toMonument = new THREE.Vector3();
    this._cameraWorldPosition = new THREE.Vector3();
    this._monumentDirection = new THREE.Vector3();
    this._planetWorldPosition = new THREE.Vector3();
    this.monumentWorldPosition = new THREE.Vector3();
    this.surfaceNormal = new THREE.Vector3(0, 1, 0);

    this.planet = createAtmosphericPlanet({
      radius: this.radius, position: [0, 0, 0], quality: this.quality, mobile: options.mobile,
      oceanColor: data.oceanColor, oceanShallowColor: data.oceanShallowColor,
      landColor: data.landColor, landHighColor: data.landHighColor, iceColor: data.iceColor,
      rimColor: data.rimColor, rotationSpeed: data.rotationSpeed
    });
    this.add(this.planet.object3D);

    const localNormal = vectorFrom(data.surfaceNormal ?? options.surfaceNormal, new THREE.Vector3(0.48, 0.16, 0.86)).normalize();
    this._localSurfaceNormal = localNormal;
    this.monument = new THREE.Group();
    this.monument.position.copy(localNormal).multiplyScalar(this.radius * 1.003);
    this.monument.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);
    // Parent to the rotating terrain shell so the monument never slips across
    // the procedural continents as the planet turns.
    this.planet.surface.add(this.monument);
    this._buildSurfaceGlow(data);
    this._buildRockBase(data);
    this._buildProjection(data);

    this.hitTargets.push(this.planet.surface, this.monumentProxy);
    this.planet.surface.userData.memoryCarrier = this;
    this.monumentProxy.userData.memoryCarrier = this;
    this.monument.userData.surfaceNormal = this.surfaceNormal;
    this.userData.surfaceNormal = this.surfaceNormal;
    this.userData.monumentWorldPosition = this.monumentWorldPosition;
    this.ready = this._loadTexture(data.src);
    this.setQuality(this.quality);
    this.setDiscoveryProgress(this.discoveryProgress);
    this._syncWorldSurface();
  }

  _buildSurfaceGlow(data) {
    const size = Math.min(this.radius * 0.38, data.glowRadius ?? 3.1);
    const geometry = new THREE.CircleGeometry(size, this.quality === 'low' ? 20 : 48);
    curveDisc(geometry, this.radius, 0.025);
    this.glowUniforms = {
      uReveal: { value: this.discoveryProgress }, uPulse: { value: 1 },
      uColor: { value: new THREE.Color(data.glowColor ?? 0xe0a66d) }
    };
    this.glowMaterial = new THREE.ShaderMaterial({
      uniforms: this.glowUniforms, vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2
    });
    this.surfaceGlow = new THREE.Mesh(geometry, this.glowMaterial);
    this.monument.add(this.surfaceGlow);
  }

  _buildRockBase(data) {
    this.rockBase = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({ color: data.rockColor ?? 0x403a36, roughness: 0.93, metalness: 0.04 });
    const plinth = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 1), rock);
    plinth.scale.set(1.5, 1.05, 0.38); plinth.position.z = 0.28; plinth.rotation.z = 0.18;
    this.rockBase.add(plinth);
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 1.15), rock.clone());
      const angle = i * 1.51 + 0.25;
      shard.position.set(Math.cos(angle) * 0.62, Math.sin(angle) * 0.5, 0.72);
      shard.rotation.set(0.08 * i, 0.13 * (i - 1), angle + 0.2);
      shard.scale.set(0.75 + i * 0.08, 0.8, 0.72 + (i % 2) * 0.24);
      this.rockBase.add(shard);
    }
    this.monument.add(this.rockBase);
  }

  _buildProjection(data) {
    this.texture = createFallbackTexture();
    const size = data.projectionSize || [3.2, 2.25];
    this.photoUniforms = {
      uMap: { value: this.texture }, uGlowColor: { value: new THREE.Color(data.glowColor ?? 0xe0a66d) },
      uReveal: { value: this.discoveryProgress }, uPulse: { value: 1 }, uCurve: { value: data.curve ?? 0.14 }
    };
    const geometry = new THREE.PlaneGeometry(size[0], size[1], this.quality === 'low' ? 4 : 16, 4);
    const material = new THREE.ShaderMaterial({
      uniforms: this.photoUniforms, vertexShader: PHOTO_VERTEX, fragmentShader: PHOTO_FRAGMENT,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    this.projectedLight = new THREE.Mesh(geometry, material);
    this.projectedLight.position.z = data.projectionHeight ?? 2.25;
    this.monument.add(this.projectedLight);

    const proxyGeometry = new THREE.SphereGeometry(Math.max(size[0], size[1]) * 0.58, 12, 8);
    this.monumentProxy = new THREE.Mesh(proxyGeometry, new THREE.MeshBasicMaterial({ visible: false }));
    this.monumentProxy.position.copy(this.projectedLight.position);
    this.monument.add(this.monumentProxy);
  }

  async _loadTexture(url) {
    const result = await loadCarrierTexture(url, { fallback: this.texture, anisotropy: this.quality === 'high' ? 4 : 1 });
    if (this.disposed) { if (!result.fallback) result.texture?.dispose(); return result; }
    if (!result.fallback && result.texture) {
      const previous = this.texture;
      this.texture = result.texture;
      this.photoUniforms.uMap.value = result.texture;
      previous?.dispose();
    }
    if (result.error && typeof this.data.onTextureError === 'function') this.data.onTextureError(result.error, this);
    return result;
  }

  setDiscoveryProgress(progress = 0) {
    super.setDiscoveryProgress(progress);
    if (this.photoUniforms) this.photoUniforms.uReveal.value = this.discoveryProgress;
    if (this.glowUniforms) this.glowUniforms.uReveal.value = this.discoveryProgress;
    return this;
  }

  setQuality(quality = 'high') {
    super.setQuality(quality);
    this.planet?.setQuality(quality);
    if (this.texture) { this.texture.anisotropy = quality === 'high' ? 4 : 1; this.texture.needsUpdate = true; }
    return this;
  }

  getFocusMetadata(target = {}) {
    super.getFocusMetadata(target);
    target.object = this.monument;
    target.surfaceNormal = this.surfaceNormal;
    target.monumentWorldPosition = this.monumentWorldPosition;
    target.altitude = this.data.diveAltitude ?? 4;
    return target;
  }

  getDiscoverySample(context = {}) {
    const camera = context.camera;
    this._syncWorldSurface();
    let monumentDistance = Infinity, planetDistance = Infinity, aimed = false;
    if (camera?.getWorldPosition) {
      camera.getWorldPosition(this._cameraWorldPosition);
      monumentDistance = this._cameraWorldPosition.distanceTo(this.monumentWorldPosition);
      planetDistance = Math.max(0, this._cameraWorldPosition.distanceTo(this._planetWorldPosition) - this.radius);
      camera.getWorldDirection(this._toMonument);
      this._monumentDirection.subVectors(this.monumentWorldPosition, this._cameraWorldPosition).normalize();
      aimed = this._toMonument.dot(this._monumentDirection) > (this.data.discovery?.aimThreshold ?? 0.975);
    }
    const explicit = context.aimedTarget || context.hitTarget || context.target;
    if (explicit) aimed = explicit === this.monumentProxy || explicit === this.monument || explicit.userData?.memoryCarrier === this;
    const range = this.data.discovery?.distance ?? Math.max(5, this.radius * 0.8);
    const proximity = clamp01(1 - Math.min(monumentDistance, planetDistance) / range);
    const reveal = this.discoveryProgress >= 0.995 || this.visited;
    return {
      type: 'proximity', active: this.unlocked && proximity > 0 && aimed, inProximity: proximity > 0,
      aimed, proximity, distance: monumentDistance, planetDistance,
      duration: this.data.discovery?.requiredSeconds ?? 1.2, requiredSeconds: this.data.discovery?.requiredSeconds ?? 1.2,
      canCapture: reveal
    };
  }

  _syncWorldSurface() {
    this.planet.object3D.getWorldPosition(this._planetWorldPosition);
    this.monument.getWorldPosition(this.monumentWorldPosition);
    this.surfaceNormal.copy(this._localSurfaceNormal).transformDirection(this.planet.surface.matrixWorld).normalize();
  }

  update(delta, context = {}) {
    if (this.disposed) return;
    const dt = Math.min(Math.max(Number(delta) || 0, 0), 0.1);
    this._elapsed = Number.isFinite(context.elapsed) ? context.elapsed : this._elapsed + dt;
    this.planet.update(dt, { elapsed: this._elapsed });
    this._syncWorldSurface();
    const camera = context.camera;
    if (camera?.getWorldQuaternion) {
      camera.getWorldQuaternion(this._cameraQuaternion);
      this.monument.getWorldQuaternion(this._parentQuaternion);
      this.projectedLight.quaternion.copy(this._parentQuaternion.invert().multiply(this._cameraQuaternion));
    }
    const motion = this.reducedMotion ? 1 : 0.9 + Math.sin(this._elapsed * 1.35 + this.memoryId.length) * 0.1;
    const pulse = motion * (0.22 + this.discoveryProgress * 0.78);
    this.photoUniforms.uPulse.value = pulse;
    this.glowUniforms.uPulse.value = pulse;
  }

  dispose() {
    if (this.disposed) return;
    // AtmosphericPlanet owns the shared planet geometry/materials. Detach the
    // monument first so MemoryCarrier can independently dispose its resources.
    this.monument?.removeFromParent();
    if (this.monument) this.add(this.monument);
    this.planet?.dispose();
    this.texture?.dispose();
    this.texture = null;
    super.dispose();
    this.planet = null;
    this.photoUniforms = null;
    this.glowUniforms = null;
  }
}
