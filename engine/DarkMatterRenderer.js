import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';

export class DarkMatterRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, options);
    this.params = data.physicsParams || {};
    this.narrative = data.narrative || {};
    this.media = data.media || {};
    this.galaxies = [];
    this.darkMatterZones = [];
    this.einsteinArcs = [];
    this.shearContours = null;
    this.starfield = null;
    this.draggedGalaxy = null;
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.raycaster = new THREE.Raycaster();
    this.unlocked = false;
    this.convergencePoint = new THREE.Vector3(0, 0, 0);
    this.dmParams = {};
  }

  async init() {
    const p = this.params.darkMatter || {};
    const ic = this.data.interactionConfig || {};
    this.dmParams = p;

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    const einsteinRadius = p.einsteinRadius || 120;
    const hiddenCount = p.hiddenMemoryCount || 3;

    this._createDarkMatterZones(hiddenCount, einsteinRadius);
    this._createGalaxies(hiddenCount, einsteinRadius);
    this._createShearContours(p);
    this._createStarfield(1500);

    this.camera.position.set(0, 0, 600);
    this.camera.lookAt(0, 0, 0);

    this.scene.fog = new THREE.FogExp2(0x000011, 0.0005);

    window.dispatchEvent(new CustomEvent('darkMatterReady', {
      detail: { hiddenMemoryCount: hiddenCount, einsteinRadius }
    }));
  }

  _createDarkMatterZones(count, einsteinRadius) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * einsteinRadius;
      const y = Math.sin(angle) * einsteinRadius;
      const zone = {
        position: new THREE.Vector3(x, y, 0),
        radius: einsteinRadius,
        index: i,
        active: false
      };
      const geo = new THREE.SphereGeometry(einsteinRadius * 0.15, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x1a1a3a,
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(zone.position);
      zone.mesh = mesh;
      this.scene.add(mesh);
      this.addDisposable(geo);
      this.addDisposable(mat);
      this.darkMatterZones.push(zone);
    }
  }

  _createGalaxies(count, einsteinRadius) {
    const galaxyColors = [0xff6644, 0x44aaff, 0xffaa44, 0x66ff88, 0xff44ff];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.PI / 6;
      const dist = einsteinRadius * 3;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const geo = new THREE.PlaneGeometry(40, 40);
      const mat = new THREE.MeshBasicMaterial({
        color: galaxyColors[i % galaxyColors.length],
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const galaxy = new THREE.Mesh(geo, mat);
      galaxy.position.set(x, y, 0);
      galaxy.userData = {
        basePos: new THREE.Vector3(x, y, 0),
        targetZone: i,
        phase: Math.random() * Math.PI * 2,
        captured: false
      };
      this.scene.add(galaxy);
      this.addDisposable(geo);
      this.addDisposable(mat);
      this.galaxies.push(galaxy);
    }
  }

  _createShearContours(p) {
    const opacity = p.shearFieldOpacity || 0.15;
    const points = [];
    const segments = 64;
    for (let ring = 0; ring < 4; ring++) {
      const radius = 300 + ring * 80;
      for (let i = 0; i < segments; i++) {
        const a1 = (i / segments) * Math.PI * 2;
        const a2 = ((i + 1) / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a1) * radius, Math.sin(a1) * radius, -100));
        points.push(new THREE.Vector3(Math.cos(a2) * radius, Math.sin(a2) * radius, -100));
      }
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x335577,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending
    });
    this.shearContours = new THREE.LineSegments(geo, mat);
    this.scene.add(this.shearContours);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _createStarfield(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = 1500 + Math.random() * 2500;
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
      opacity: 0.7,
      sizeAttenuation: false
    });
    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
    this.addDisposable(geo);
    this.addDisposable(mat);
  }

  _screenToNDC(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1
    );
  }

  _clearArcs() {
    for (const arc of this.einsteinArcs) {
      this.scene.remove(arc);
      arc.geometry.dispose();
      arc.material.dispose();
    }
    this.einsteinArcs = [];
  }

  _updateEinsteinArcs() {
    const p = this.dmParams;
    const einsteinRadius = p.einsteinRadius || 120;
    const threshold = einsteinRadius * 0.8;
    this._clearArcs();
    let activeCount = 0;

    for (const galaxy of this.galaxies) {
      const zone = this.darkMatterZones[galaxy.userData.targetZone];
      const dist = galaxy.position.distanceTo(zone.position);
      zone.active = dist < threshold * 2;
      galaxy.userData.captured = dist < threshold;

      if (dist < threshold * 2) {
        activeCount++;
        const angleToGalaxy = Math.atan2(
          galaxy.position.y - zone.position.y,
          galaxy.position.x - zone.position.x
        );
        const proximity = 1 - dist / (threshold * 2);
        const arcSpan = Math.PI * (0.2 + proximity * 0.5);
        const curve = new THREE.EllipseCurve(
          zone.position.x, zone.position.y,
          einsteinRadius, einsteinRadius,
          angleToGalaxy - arcSpan, angleToGalaxy + arcSpan,
          false, 0
        );
        const points2D = curve.getPoints(48);
        const points3D = points2D.map(pt => new THREE.Vector3(pt.x, pt.y, 0.5));
        const geo = new THREE.BufferGeometry().setFromPoints(points3D);
        const mat = new THREE.LineBasicMaterial({
          color: new THREE.Color().setHSL(0.6 - proximity * 0.15, 0.8, 0.5 + proximity * 0.2),
          transparent: true,
          opacity: 0.3 + proximity * 0.5,
          blending: THREE.AdditiveBlending
        });
        const arc = new THREE.Line(geo, mat);
        this.scene.add(arc);
        this.einsteinArcs.push(arc);
      }
    }

    if (activeCount >= (p.hiddenMemoryCount || 3) && !this.unlocked) {
      this._checkConvergence();
    }
  }

  _checkConvergence() {
    const p = this.dmParams;
    const einsteinRadius = p.einsteinRadius || 120;
    const convThreshold = (p.convergenceThreshold || 0.8) * einsteinRadius * 0.25;
    let allClose = true;

    for (const arc of this.einsteinArcs) {
      const positions = arc.geometry.attributes.position.array;
      let minDist = Infinity;
      for (let i = 0; i < positions.length; i += 3) {
        const dx = positions[i] - this.convergencePoint.x;
        const dy = positions[i + 1] - this.convergencePoint.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) minDist = d;
      }
      if (minDist > convThreshold) {
        allClose = false;
        break;
      }
    }

    if (allClose) {
      this.unlocked = true;
      window.dispatchEvent(new CustomEvent('hiddenMemoryUnlocked', {
        detail: { convergencePoint: this.convergencePoint.toArray() }
      }));
    }
  }

  onDragStart(x, y) {
    const mouse = this._screenToNDC(x, y);
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.galaxies);
    if (intersects.length > 0) {
      this.draggedGalaxy = intersects[0].object;
    }
  }

  onDrag(deltaX, deltaY, startX, startY, currentX, currentY) {
    if (!this.draggedGalaxy) return;
    const mouse = this._screenToNDC(currentX, currentY);
    this.raycaster.setFromCamera(mouse, this.camera);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.dragPlane, point)) {
      this.draggedGalaxy.position.copy(point);
      this.draggedGalaxy.position.z = 0;
    }
    this._updateEinsteinArcs();
  }

  onDragEnd(totalDeltaX, totalDeltaY) {
    this.draggedGalaxy = null;
    let allCaptured = true;
    for (const galaxy of this.galaxies) {
      if (!galaxy.userData.captured) {
        allCaptured = false;
        break;
      }
    }
    if (allCaptured && !this.unlocked) {
      this._checkConvergence();
    }
    window.dispatchEvent(new CustomEvent('darkMatterDragEnd', {
      detail: { allCaptured, unlocked: this.unlocked }
    }));
  }

  update(deltaTime, elapsedTime) {
    for (const galaxy of this.galaxies) {
      if (galaxy !== this.draggedGalaxy) {
        const phase = galaxy.userData.phase;
        const base = galaxy.userData.basePos;
        galaxy.position.x = base.x + Math.sin(elapsedTime * 0.5 + phase) * 8;
        galaxy.position.y = base.y + Math.cos(elapsedTime * 0.4 + phase) * 8;
      }
      galaxy.rotation.z += deltaTime * 0.1;
    }

    if (this.shearContours) {
      const baseOpacity = this.dmParams.shearFieldOpacity || 0.15;
      this.shearContours.material.opacity = baseOpacity * (0.7 + Math.sin(elapsedTime * 0.6) * 0.3);
      this.shearContours.rotation.z = elapsedTime * 0.02;
    }

    if (this.starfield) {
      this.starfield.rotation.y += deltaTime * 0.003;
    }

    for (const zone of this.darkMatterZones) {
      if (zone.mesh) {
        zone.mesh.material.opacity = zone.active ? 0.06 : 0.0;
      }
    }

    for (const arc of this.einsteinArcs) {
      const base = arc.material.opacity;
      arc.material.opacity = base * (0.9 + Math.sin(elapsedTime * 2 + arc.position.x) * 0.1);
    }
  }

  onQualityChange(quality) {
    if (this.starfield) {
      this.starfield.material.size = quality === 'low' ? 1 : 2;
    }
  }

  destroy() {
    this._clearArcs();
    super.destroy();
  }
}
