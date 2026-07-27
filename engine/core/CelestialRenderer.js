import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class CelestialRenderer {
  constructor(canvas, data, options = {}) {
    this.canvas = canvas;
    this.data = data;
    this.params = data.physicsParams || {};
    this.narrative = data.narrative || {};
    this.media = data.media || {};
    this.options = options;

    this.scene = new THREE.Scene();

    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    this.camera.position.set(0, 0, 100);

    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) {
      throw new Error('您的浏览器不支持 WebGL，无法运行此应用。请使用现代浏览器。');
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: options.antialias !== false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.clock = new THREE.Clock();
    this.isActive = false;
    this.animationId = null;

    this.eventBindings = [];
    this.disposables = [];

    this.loadingManager = new THREE.LoadingManager();
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);

    this._renderFrameBound = this.renderFrame.bind(this);
  }

  async init() {
    throw new Error('init() must be implemented by subclass');
  }

  update(deltaTime, elapsedTime) {}

  onScroll(deltaY, deltaX) {}
  onDrag(deltaX, deltaY, startX, startY, currentX, currentY) {}
  onDragStart(x, y) {}
  onDragEnd(totalDeltaX, totalDeltaY) {}
  onTap(x, y) {}
  onPinch(scale, centerX, centerY) {}
  onQualityChange(quality) {}

  onResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  renderFrame() {
    if (!this.isActive) return;

    const deltaTime = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    this.update(deltaTime, elapsedTime);
    this.renderer.render(this.scene, this.camera);

    this.animationId = requestAnimationFrame(this._renderFrameBound);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.clock.start();
    this.renderFrame();
  }

  pause() {
    this.isActive = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.pause();

    this.eventBindings.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.eventBindings = [];

    this.disposables.forEach(obj => {
      if (obj instanceof THREE.Texture) {
        obj.dispose();
      } else if (obj instanceof THREE.Material) {
        obj.dispose();
      } else if (obj instanceof THREE.BufferGeometry) {
        obj.dispose();
      } else if (Array.isArray(obj)) {
        obj.forEach(item => {
          if (item && typeof item.dispose === 'function') {
            item.dispose();
          }
        });
      } else if (obj && typeof obj.dispose === 'function') {
        obj.dispose();
      }
    });
    this.disposables = [];

    const children = [...this.scene.children];
    children.forEach(child => {
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.scene.remove(child);
    });

    this.renderer.dispose();
  }

  async loadTexture(url) {
    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        texture => {
          this.addDisposable(texture);
          resolve(texture);
        },
        undefined,
        error => reject(error)
      );
    });
  }

  addDisposable(obj) {
    this.disposables.push(obj);
  }

  bindEvent(element, event, handler, options) {
    element.addEventListener(event, handler, options);
    this.eventBindings.push({ element, event, handler, options });
  }
}
