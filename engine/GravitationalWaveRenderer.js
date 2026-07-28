import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';

export class GravitationalWaveRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, options);
    this.params = data.physicsParams || {};
    this.narrative = data.narrative || {};
    this.media = data.media || {};
    this.primary = null;
    this.secondary = null;
    this.mergedBlackHole = null;
    this.debris = null;
    this.ripples = [];
    this.starfield = null;
    this.orbitRadius = 200;
    this.minOrbitRadius = 30;
    this.orbitalAngle = 0;
    this.orbitalSpeedMult = 1.0;
    this.massRatio = 1.0;
    this.merged = false;
    this.mergerTime = 0;
    this.massLoss = 0;
    this.finalMass = 0;
    this.gwParams = {};
  }

  async init() {
    const p = this.params.gravitationalWave || {};
    this.gwParams = p;

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this._createBinarySystem(p);
    this._createDebrisField(200);
    this._createStarfield(1500);

    this.camera.position.set(0, 0, 600);
    this.camera.lookAt(0, 0, 0);

    this.orbitRadius = p.initialOrbitRadius || 200;
    this.orbitRadius = Math.min(this.orbitRadius, 250);

    window.dispatchEvent(new CustomEvent('gravitationalWaveReady', {
      detail: {
        primaryMass: p.primaryMass || 35,
        secondaryMass: p.secondaryMass || 30,
        canMerge: true
      }
    }));
  }

  _createBinarySystem(p) {
    const pm = p.primaryMass || 35;
    const sm = p.secondaryMass || 30;
    const r1 = Math.max(8, pm * 0.4);
    const r2 = Math.max(8, sm * 0.4);

    const geo1 = new THREE.SphereGeometry(r1, 32, 32);
    const mat1 = new THREE.MeshBasicMaterial({ color: 0x66aaff });
    this.primary = new THREE.Mesh(geo1, mat1);
    this.primary.userData = { mass: pm, radius: r1 };
    this.scene.add(this.primary);
    this.addDisposable(geo1);
    this.addDisposable(mat1);

    const glow1Geo = new THREE.SphereGeometry(r1 * 1.5, 16, 16);
    const glow1Mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const glow1 = new THREE.Mesh(glow1Geo, glow1Mat);
    this.primary.add(glow1);
    this.addDisposable(glow1Geo);
    this.addDisposable(glow1Mat);

    const geo2 = new THREE.SphereGeometry(r2, 32, 32);
    const mat2 = new THREE.MeshBasicMaterial({ color: 0xffaa66 });
    this.secondary = new THREE.Mesh(geo2, mat2);
    this.secondary.userData = { mass: sm, radius: r2 };
    this.scene.add(this.secondary);
    this.addDisposable(geo2);
    this.addDisposable(mat2);

    const glow2Geo = new THREE.SphereGeometry(r2 * 1.5, 16, 16);
    const glow2Mat = new THREE.MeshBasicMaterial({
      color: 0xff8844,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const glow2 = new THREE.Mesh(glow2Geo, glow2Mat);
    this.secondary.add(glow2);
    this.addDisposable(glow2Geo);
    this.addDisposable(glow2Mat);
  }

  _createDebrisField(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const baseData = [];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 150 + Math.random() * 350;
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = (Math.random() - 0.5) * 100;
      baseData.push({ x, y, z: positions[i3 + 2] });
      const c = 0.4 + Math.random() * 0.4;
      colors[i3] = c * 0.8;
      colors[i3 + 1] = c * 0.9;
      colors[i3 + 2] = c;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 2.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.debris = new THREE.Points(geo, mat);
    this.debris.userData = { baseData };
    this.scene.add(this.debris);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createStarfield(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 1800 + Math.random() * 3000;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = r * Math.cos(phi);
      const c = 0.3 + Math.random() * 0.7;
      colors[i3] = c;
      colors[i3 + 1] = c * 0.9;
      colors[i3 + 2] = c;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: false
    });
    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _updateOrbit(deltaTime, elapsedTime) {
    if (this.merged) return;
    const p = this.gwParams;
    const pm = p.primaryMass || 35;
    const sm = p.secondaryMass || 30;
    const totalMass = pm + sm;

    const decayRate = p.orbitalDecayRate || 0.02;
    this.orbitRadius -= decayRate * deltaTime * 50;
    this.orbitRadius = Math.max(this.minOrbitRadius, this.orbitRadius);

    const baseSpeed = Math.sqrt(totalMass / Math.max(1, this.orbitRadius)) * 0.3;
    const angularVel = baseSpeed * this.orbitalSpeedMult;
    this.orbitalAngle += angularVel * deltaTime;

    const r1 = this.orbitRadius * (sm / totalMass);
    const r2 = this.orbitRadius * (pm / totalMass);

    this.primary.position.x = Math.cos(this.orbitalAngle) * r1;
    this.primary.position.y = Math.sin(this.orbitalAngle) * r1;
    this.secondary.position.x = -Math.cos(this.orbitalAngle) * r2;
    this.secondary.position.y = -Math.sin(this.orbitalAngle) * r2;

    if (this.orbitRadius <= this.minOrbitRadius * 1.2) {
      this._merge();
    }
  }

  _updateDebrisWave(elapsedTime) {
    if (!this.debris) return;
    const p = this.gwParams;
    const amplitude = p.waveAmplitude || 1.5;
    const freq = this.merged ? (p.ringdownFrequency || 250) * 0.02 : this.orbitalSpeedMult * 2;

    const pos = this.debris.geometry.attributes.position.array;
    const baseData = this.debris.userData.baseData;
    const mergerProgress = this.merged ? Math.min(1, (elapsedTime - this.mergerTime) * 0.5) : 0;

    for (let i = 0; i < baseData.length; i++) {
      const i3 = i * 3;
      const base = baseData[i];
      const dist = Math.sqrt(base.x * base.x + base.y * base.y);
      const wave = Math.sin(elapsedTime * freq - dist * 0.03) * amplitude * 10;
      const permanentOffset = Math.sin(base.x * 0.02) * amplitude * 15 * mergerProgress;

      pos[i3] = base.x + wave * 0.3;
      pos[i3 + 1] = base.y + wave + permanentOffset;
      pos[i3 + 2] = base.z + wave * 0.2;
    }
    this.debris.geometry.attributes.position.needsUpdate = true;
  }

  _merge() {
    if (this.merged) return;
    this.merged = true;
    this.mergerTime = this.clock.getElapsedTime();
    const p = this.gwParams;
    const pm = p.primaryMass || 35;
    const sm = p.secondaryMass || 30;
    const totalMass = pm + sm;
    const ratio = p.massEnergyRatio || 0.05;
    this.massLoss = totalMass * ratio;
    this.finalMass = totalMass - this.massLoss;

    this.primary.visible = false;
    this.secondary.visible = false;

    const mergedRadius = Math.max(10, this.finalMass * 0.4);
    const geo = new THREE.SphereGeometry(mergedRadius, 48, 48);
    const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.mergedBlackHole = new THREE.Mesh(geo, mat);
    this.scene.add(this.mergedBlackHole);
    this.addDisposable(geo);
    this.addDisposable(mat);

    const glowGeo = new THREE.SphereGeometry(mergedRadius * 1.8, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    this.mergedBlackHole.add(glow);
    this.addDisposable(glowGeo);
    this.addDisposable(glowMat);

    this._createRipples();

    window.dispatchEvent(new CustomEvent('mergerComplete', {
      detail: {
        massLoss: this.massLoss,
        finalMass: this.finalMass
      }
    }));
  }

  _createRipples() {
    const p = this.gwParams;
    const amplitude = p.waveAmplitude || 1.5;

    for (let i = 0; i < 4; i++) {
      const geo = new THREE.RingGeometry(5, 7, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.6 - i * 0.05, 0.7, 0.5),
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.userData = { delay: i * 0.25, maxRadius: 600, amplitude };
      this.ripples.push(ring);
      this.scene.add(ring);
      this.addDisposable(geo);
      this.addDisposable(mat);
    }
  }

  _updateRipples(elapsedTime) {
    if (!this.merged) return;
    const timeSinceMerger = elapsedTime - this.mergerTime;
    for (const ring of this.ripples) {
      const t = Math.max(0, timeSinceMerger - ring.userData.delay);
      const radius = t * 250;
      ring.scale.setScalar(Math.max(0.01, radius / 5));
      ring.material.opacity = Math.max(0, 0.7 * Math.exp(-t * 0.8));
    }
  }

  _updateRingdown(elapsedTime) {
    if (!this.merged || !this.mergedBlackHole) return;
    const p = this.gwParams;
    const freq = p.ringdownFrequency || 250;
    const timeSinceMerger = elapsedTime - this.mergerTime;
    const damping = Math.exp(-timeSinceMerger * 1.5);
    const oscillation = Math.sin(timeSinceMerger * freq * 0.05) * damping * 0.15;
    this.mergedBlackHole.scale.setScalar(1 + oscillation);

    const glow = this.mergedBlackHole.children[0];
    if (glow) {
      glow.material.opacity = 0.15 + oscillation * 0.3;
    }
  }

  onDrag(deltaX, deltaY, startX, startY, currentX, currentY) {
    if (this.merged) return;
    this.orbitalSpeedMult = Math.max(0.2, this.orbitalSpeedMult + deltaX * 0.002);
    this.massRatio = Math.max(0.3, Math.min(3, this.massRatio + deltaY * 0.002));

    window.dispatchEvent(new CustomEvent('orbitalParamsChange', {
      detail: {
        speed: this.orbitalSpeedMult,
        massRatio: this.massRatio,
        orbitRadius: this.orbitRadius
      }
    }));
  }

  onTap(x, y) {
    if (!this.merged) {
      this._merge();
    }
  }

  onPinch(scale, centerX, centerY) {
    if (this.merged) return;
    this.orbitalSpeedMult = Math.max(0.2, Math.min(5, this.orbitalSpeedMult * scale));
  }

  update(deltaTime, elapsedTime) {
    this._updateOrbit(deltaTime, elapsedTime);
    this._updateDebrisWave(elapsedTime);
    this._updateRipples(elapsedTime);
    this._updateRingdown(elapsedTime);

    if (this.primary && !this.merged) {
      this.primary.rotation.y += deltaTime * 2;
    }
    if (this.secondary && !this.merged) {
      this.secondary.rotation.y -= deltaTime * 2;
    }

    if (this.starfield) {
      this.starfield.rotation.y += deltaTime * 0.002;
    }

    if (this.mergedBlackHole) {
      this.mergedBlackHole.rotation.y += deltaTime * 0.5;
    }
  }

  onQualityChange(quality) {
    if (this.starfield) {
      this.starfield.material.size = quality === 'low' ? 1 : 2;
    }
    if (this.debris) {
      this.debris.material.size = quality === 'low' ? 1.5 : 2.5;
    }
  }
}
