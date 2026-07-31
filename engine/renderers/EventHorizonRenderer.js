import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';
import { createDeepSpaceBackground } from '../core/DeepSpaceBackground.js';

export class EventHorizonRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, options);
    this.params = data.physicsParams || {};
    this.narrative = data.narrative || {};
    this.media = data.media || {};
    this.scrollProgress = 0;
    this.crossedHorizon = false;
    this.cameraStartZ = 800;
    this.blackHole = null;
    this.accretionDisk = null;
    this.photonSphere = null;
    this.starfield = null;
    this.deepSpace = null;
    this.ambientParticles = null;
    this.ambientVelocities = null;
    this.renderTarget = null;
    this.lensingScene = null;
    this.lensingCamera = null;
    this.lensingQuad = null;
    this.lensingMaterial = null;
    this.ehParams = {};
  }

  async _loadShader(name) {
    const url = new URL(`../shaders/${name}`, import.meta.url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load shader ${name}: ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  async init() {
    const p = this.params.eventHorizon || {};
    const ic = this.data.interactionConfig || {};
    const camStart = ic.cameraStart || {};
    this.ehParams = p;

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const commonSrc = await this._loadShader('common.glsl');
    const diskFrag = await this._loadShader('accretionDisk.frag');
    const lensingFrag = await this._loadShader('gravitationalLensing.frag');
    const bhVert = await this._loadShader('blackhole.vert');
    const bhFrag = await this._loadShader('blackhole.frag');

    const diskFragFull = commonSrc + '\n' + diskFrag;
    const lensingFragFull = commonSrc + '\n' + lensingFrag;
    const bhFragFull = commonSrc + '\n' + bhFrag;

    const rs = Math.max(0.001, p.schwarzschildRadius);

    this._createBlackHole(rs, bhVert, bhFragFull, p);
    this._createAccretionDisk(rs, p, diskFragFull, bhVert);
    this._createPhotonSphere(Math.max(0.001, p.photonSphereRadius));
    this._createStarfield(2000);
    this._createAmbientParticles(ic.ambientParticles || 150);

    this.deepSpace = createDeepSpaceBackground({
      starCount: 5000, dustCount: 1500, starRadius: 3000,
      dustExtent: [1400, 600, 900], dustPosition: [0, 0, -800],
      pixelRatio: this.renderer.getPixelRatio()
    });
    this.scene.add(this.deepSpace.object3D);

    this._setupPostProcessing(w, h, p, lensingFragFull);

    this.cameraStartZ = camStart.position ? camStart.position[2] : 800;
    this.camera.position.set(
      camStart.position ? camStart.position[0] : 0,
      camStart.position ? camStart.position[1] : 0,
      this.cameraStartZ
    );
    const lookAt = camStart.lookAt || [0, 0, 0];
    this.camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);

    this.scene.fog = new THREE.FogExp2(0x000005, 0.0003);
  }

  _createBlackHole(rs, vert, frag, p) {
    const geo = new THREE.SphereGeometry(rs, 64, 64);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uSchwarzschildRadius: { value: p.schwarzschildRadius },
        uScrollProgress: { value: 0 }
      }
    });
    this.blackHole = new THREE.Mesh(geo, mat);
    this.scene.add(this.blackHole);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createAccretionDisk(rs, p, frag, vert) {
    const inner = rs * 1.3;
    const outer = rs * 4.5;
    const geo = new THREE.RingGeometry(inner, outer, 128, 8);
    const temperature = 8000 + p.accretionRate * 20000;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uTime: { value: 0 },
        uSpin: { value: p.spin },
        uAccretionRate: { value: p.accretionRate },
        uTemperature: { value: temperature }
      },
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.accretionDisk = new THREE.Mesh(geo, mat);
    this.accretionDisk.rotation.x = -Math.PI / 2;
    this.scene.add(this.accretionDisk);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createPhotonSphere(psr) {
    const geo = new THREE.SphereGeometry(psr, 32, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3388ff,
      transparent: true,
      opacity: 0.04,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.photonSphere = new THREE.Mesh(geo, mat);
    this.scene.add(this.photonSphere);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createStarfield(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 2500 + Math.random() * 4000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      const c = 0.4 + Math.random() * 0.6;
      colors[i3] = c;
      colors[i3 + 1] = c * (0.8 + Math.random() * 0.2);
      colors[i3 + 2] = c * (0.9 + Math.random() * 0.3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: false
    });
    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createAmbientParticles(count) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 2000;
      positions[i3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i3 + 2] = (Math.random() - 0.5) * 2000;
      velocities[i3] = (Math.random() - 0.5) * 0.3;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.3;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.ambientVelocities = velocities;
    const mat = new THREE.PointsMaterial({
      size: 1.5,
      color: 0x4488cc,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.ambientParticles = new THREE.Points(geo, mat);
    this.scene.add(this.ambientParticles);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _setupPostProcessing(w, h, p, lensingFrag) {
    this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });
    this.addDisposable(this.renderTarget);

    this.lensingScene = new THREE.Scene();
    this.lensingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadVert = 'varying vec2 vUv;\nvoid main() {\n  vUv = uv;\n  gl_Position = vec4(position, 1.0);\n}';
    this.lensingMaterial = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: lensingFrag,
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture },
        uLensingStrength: { value: p.lensingStrength },
        uSchwarzschildRadius: { value: p.schwarzschildRadius },
        uScrollProgress: { value: 0 },
        uResolution: { value: new THREE.Vector2(w, h) },
        uTime: { value: 0 },
        uBlackHoleScreenPos: { value: new THREE.Vector2(0.5, 0.5) }
      },
      depthTest: false,
      depthWrite: false
    });
    this.lensingQuad = new THREE.Mesh(quadGeo, this.lensingMaterial);
    this.lensingScene.add(this.lensingQuad);
    this.addDisposable(quadGeo);
    this.addDisposable(this.lensingMaterial);
  }

  update(deltaTime, elapsedTime) {
    const p = this.ehParams;

    if (this.accretionDisk) {
      this.accretionDisk.rotation.z += deltaTime * (p.spin || 0.5) * 0.5;
      this.accretionDisk.material.uniforms.uTime.value = elapsedTime;
    }

    if (this.photonSphere) {
      const pulse = 1 + Math.sin(elapsedTime * 0.8) * 0.03;
      this.photonSphere.scale.setScalar(pulse);
      this.photonSphere.material.opacity = 0.03 + Math.sin(elapsedTime * 1.2) * 0.02;
    }

    if (this.blackHole) {
      this.blackHole.material.uniforms.uTime.value = elapsedTime;
      this.blackHole.material.uniforms.uScrollProgress.value = this.scrollProgress;
    }

    if (this.deepSpace) {
      this.deepSpace.update(deltaTime, elapsedTime);
    }

    if (this.starfield) {
      this.starfield.rotation.y += deltaTime * 0.005;
    }

    if (this.ambientParticles) {
      const pos = this.ambientParticles.geometry.attributes.position.array;
      const vel = this.ambientVelocities;
      for (let i = 0; i < pos.length; i += 3) {
        pos[i] += vel[i] * deltaTime;
        pos[i + 1] += vel[i + 1] * deltaTime;
        pos[i + 2] += vel[i + 2] * deltaTime;
        const distSq = pos[i] * pos[i] + pos[i + 1] * pos[i + 1] + pos[i + 2] * pos[i + 2];
        if (distSq > 1000000) {
          pos[i] *= -0.5;
          pos[i + 1] *= -0.5;
          pos[i + 2] *= -0.5;
        }
      }
      this.ambientParticles.geometry.attributes.position.needsUpdate = true;
    }

    if (this.lensingMaterial) {
      this.lensingMaterial.uniforms.uTime.value = elapsedTime;
      this.lensingMaterial.uniforms.uScrollProgress.value = this.scrollProgress;
      const bhScreen = new THREE.Vector3(0, 0, 0);
      if (this.blackHole) bhScreen.copy(this.blackHole.position);
      bhScreen.project(this.camera);
      this.lensingMaterial.uniforms.uBlackHoleScreenPos.value.set(
        (bhScreen.x + 1) / 2,
        (bhScreen.y + 1) / 2
      );
    }

    if (this.crossedHorizon) {
      if (this.scene.fog) {
        this.scene.fog.density = 0.0003 + this.scrollProgress * 0.005;
      }
      if (this.starfield) {
        this.starfield.material.opacity = Math.max(0, 0.9 - (this.scrollProgress - 0.5) * 2);
      }
      if (this.ambientParticles) {
        this.ambientParticles.material.opacity = Math.max(0, 0.5 - (this.scrollProgress - 0.5) * 1.5);
      }
    }
  }

  onScroll(deltaY, deltaX) {
    const p = this.ehParams;
    const tdf = p.timeDilationFactor || 4.0;
    if (this.scrollProgress >= 1) return;
    const damping = 1 / (1 + this.scrollProgress * tdf);
    const delta = Math.max(0, deltaY * 0.0012 * damping);
    this.scrollProgress = Math.min(1, this.scrollProgress + delta);

    this.camera.position.z = this.cameraStartZ - this.scrollProgress * 600;

    const wasCrossed = this.crossedHorizon;
    this.crossedHorizon = this.scrollProgress >= 0.5;

    if (this.scrollProgress < 0.5) {
      const tilt = this.scrollProgress * 0.3;
      this.camera.position.y = Math.sin(this.clock.getElapsedTime() * 0.5) * tilt * 20;
    }

    if (this.crossedHorizon && !wasCrossed) {
      window.dispatchEvent(new CustomEvent('horizonCrossed', {
        detail: { progress: this.scrollProgress }
      }));
    }

    window.dispatchEvent(new CustomEvent('scrollProgress', {
      detail: {
        progress: this.scrollProgress,
        crossedHorizon: this.crossedHorizon
      }
    }));
  }

  onQualityChange(quality) {
    if (this.starfield) {
      this.starfield.material.size = quality === 'low' ? 1.5 : quality === 'medium' ? 2 : 2.5;
    }
    if (this.photonSphere) {
      this.photonSphere.visible = quality !== 'low';
    }
  }

  onResize(width, height) {
    super.onResize(width, height);
    if (this.renderTarget) {
      this.renderTarget.setSize(width, height);
    }
    if (this.lensingMaterial) {
      this.lensingMaterial.uniforms.uResolution.value.set(width, height);
    }
  }

  renderFrame() {
    if (!this.isActive) return;
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();
    this.update(dt, t);

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.lensingScene, this.lensingCamera);
    this.animationId = requestAnimationFrame(this._renderFrameBound);
  }

  destroy() {
    if (this.deepSpace) {
      this.scene.remove(this.deepSpace.object3D);
      this.deepSpace.dispose();
      this.deepSpace = null;
    }
    super.destroy();
  }
}
