import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { CelestialRenderer } from '../core/CelestialRenderer.js';

export class RedshiftRenderer extends CelestialRenderer {
  constructor(canvas, data, options = {}) {
    super(canvas, data, options);
    this.params = data.physicsParams || {};
    this.narrative = data.narrative || {};
    this.media = data.media || {};
    this.cards = [];
    this.timeline = null;
    this.zIndicator = null;
    this.starfield = null;
    this.redshift = 0;
    this.dragging = false;
    this.dragStartX = 0;
    this.dragStartZ = 0;
    this.raycaster = new THREE.Raycaster();
    this.rsParams = {};
    this.commonShaderSrc = '';
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
    const p = this.params.redshift || {};
    this.rsParams = p;

    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    this.commonShaderSrc = await this._loadShader('common.glsl');

    this._createCards(p);
    this._createTimeline();
    this._createStarfield(1000);

    this.camera.position.set(0, 0, 500);
    this.camera.lookAt(0, 0, 0);

    this._updateCards();
    window.dispatchEvent(new CustomEvent('redshiftChange', {
      detail: { z: this.redshift }
    }));
  }

  _createCards(p) {
    const count = 5;
    const cardVert = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const cardFrag = this.commonShaderSrc + '\n' + `
      varying vec2 vUv;
      uniform float uColorTemp;
      uniform float uRedshift;
      uniform float uTime;
      uniform float uCaptured;
      void main() {
        vec3 color = cm_colorTemperatureToRGB(uColorTemp);
        float blur = clamp(uRedshift / 8.0, 0.0, 0.85);
        color *= (1.0 - blur * 0.4);
        float n = cm_noise(vUv * 30.0 + uTime * 0.3) * blur * 0.25;
        color += n;
        float edge = cm_smoothBorder(0.0, 0.04, vUv.x) *
                     cm_smoothBorder(0.0, 0.04, 1.0 - vUv.x) *
                     cm_smoothBorder(0.0, 0.04, vUv.y) *
                     cm_smoothBorder(0.0, 0.04, 1.0 - vUv.y);
        color += vec3(0.4, 0.5, 0.7) * edge * 0.5;
        if (uCaptured > 0.5) {
          color += vec3(0.2, 0.3, 0.5) * 0.3;
        }
        float alpha = 0.85 * (1.0 - blur * 0.3);
        gl_FragColor = vec4(color, alpha);
      }
    `;

    const peculiarIndices = [1, 3];
    for (let i = 0; i < count; i++) {
      const geo = new THREE.PlaneGeometry(60, 80);
      const mat = new THREE.ShaderMaterial({
        vertexShader: cardVert,
        fragmentShader: cardFrag,
        uniforms: {
          uColorTemp: { value: p.colorTempNow || 6500 },
          uRedshift: { value: 0 },
          uTime: { value: 0 },
          uCaptured: { value: 0 }
        },
        transparent: true,
        side: THREE.DoubleSide
      });
      const card = new THREE.Mesh(geo, mat);
      card.userData = {
        index: i,
        peculiar: peculiarIndices.includes(i),
        captured: false,
        phase: Math.random() * Math.PI * 2,
        driftOffset: 0
      };
      this.scene.add(card);
      this.addDisposable(geo);
      this.addDisposable(mat);
      this.cards.push(card);
    }
  }

  _createTimeline() {
    const geo = new THREE.BufferGeometry();
    const points = [
      new THREE.Vector3(-300, -180, 0),
      new THREE.Vector3(300, -180, 0)
    ];
    geo.setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x4488cc,
      transparent: true,
      opacity: 0.5
    });
    this.timeline = new THREE.Line(geo, mat);
    this.scene.add(this.timeline);
    this.addDisposable(geo);
    this.addDisposable(mat);

    const indGeo = new THREE.RingGeometry(8, 12, 32);
    const indMat = new THREE.MeshBasicMaterial({
      color: 0x66bbff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    this.zIndicator = new THREE.Mesh(indGeo, indMat);
    this.zIndicator.position.set(0, -180, 1);
    this.scene.add(this.zIndicator);
    this.addDisposable(indGeo);
    this.addDisposable(indMat);
  }

  _createStarfield(count) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 3000;
      positions[i3 + 1] = (Math.random() - 0.5) * 2000;
      positions[i3 + 2] = -500 - Math.random() * 2000;
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

  _updateCards() {
    const p = this.rsParams;
    const maxZ = p.maxRedshift || 8.0;
    const colorNow = p.colorTempNow || 6500;
    const colorPast = p.colorTempPast || 2000;
    const z = this.redshift;

    const tempRange = colorNow - colorPast;
    const currentTemp = colorNow - tempRange * (z / maxZ);

    const count = this.cards.length;

    for (let i = 0; i < count; i++) {
      const card = this.cards[i];
      card.material.uniforms.uColorTemp.value = currentTemp;
      card.material.uniforms.uRedshift.value = z;
      card.material.uniforms.uCaptured.value = card.userData.captured ? 1.0 : 0.0;
    }

    this._layoutCards();

    if (this.zIndicator) {
      const indicatorX = -300 + (z / maxZ) * 600;
      this.zIndicator.position.x = indicatorX;
    }
  }

  _layoutCards() {
    const p = this.rsParams;
    const expansionRate = p.expansionRate || 0.15;
    const z = this.redshift;
    const count = this.cards.length;
    const baseSpacing = 80;
    const spacings = [];
    for (let i = 0; i < count; i++) {
      spacings.push(baseSpacing * Math.exp(i * expansionRate) * (1 + z * expansionRate * 0.5));
    }
    const totalWidth = spacings.reduce((a, b) => a + b, 0) - spacings[0];
    let x = -totalWidth / 2;
    for (let i = 0; i < count; i++) {
      this.cards[i].position.x = x;
      x += spacings[i];
    }
  }

  _screenToNDC(x, y) {
    const rect = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1
    );
  }

  onDragStart(x, y) {
    const p = this.rsParams;
    const mouse = this._screenToNDC(x, y);
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.cards);
    if (intersects.length > 0) {
      const card = intersects[0].object;
      if (card.userData.peculiar && !card.userData.captured) {
        card.userData.captured = true;
        window.dispatchEvent(new CustomEvent('peculiarCaptured', {
          detail: { cardIndex: card.userData.index }
        }));
        return;
      }
    }
    this.dragging = true;
    this.dragStartX = x;
    this.dragStartZ = this.redshift;
  }

  onDrag(deltaX, deltaY, startX, startY, currentX, currentY) {
    if (!this.dragging) return;
    const p = this.rsParams;
    const maxZ = p.maxRedshift || 8.0;
    const delta = (currentX - this.dragStartX) * -0.01;
    this.redshift = Math.max(0, Math.min(maxZ, this.dragStartZ + delta));
    this._updateCards();
    window.dispatchEvent(new CustomEvent('redshiftChange', {
      detail: { z: this.redshift }
    }));
  }

  onDragEnd(totalDeltaX, totalDeltaY) {
    this.dragging = false;
  }

  onTap(x, y) {
    const mouse = this._screenToNDC(x, y);
    this.raycaster.setFromCamera(mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.cards);
    if (intersects.length > 0) {
      const card = intersects[0].object;
      if (card.userData.peculiar && !card.userData.captured) {
        card.userData.captured = true;
        window.dispatchEvent(new CustomEvent('peculiarCaptured', {
          detail: { cardIndex: card.userData.index }
        }));
      }
    }
  }

  update(deltaTime, elapsedTime) {
    const p = this.rsParams;
    const peculiarVel = p.peculiarVelocity || 0.3;

    for (const card of this.cards) {
      card.material.uniforms.uTime.value = elapsedTime;
      if (card.userData.peculiar && !card.userData.captured) {
        card.userData.driftOffset += deltaTime * peculiarVel * 20;
        card.position.y = Math.sin(elapsedTime * 0.8 + card.userData.phase) * 15;
        card.rotation.z = Math.sin(elapsedTime * 0.5 + card.userData.phase) * 0.1;
      } else if (card.userData.captured) {
        card.position.y *= 0.95;
        card.rotation.z *= 0.95;
      }
    }

    if (this.starfield) {
      this.starfield.rotation.y += deltaTime * 0.002;
    }

    if (this.zIndicator) {
      const pulse = 1 + Math.sin(elapsedTime * 2) * 0.1;
      this.zIndicator.scale.setScalar(pulse);
    }
  }

  onQualityChange(quality) {
    if (this.starfield) {
      this.starfield.material.size = quality === 'low' ? 1 : 2;
    }
  }
}
