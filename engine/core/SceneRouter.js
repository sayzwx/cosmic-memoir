const RendererRegistry = {
  darkMatter: async () => {
    const { DarkMatterRenderer } = await import('../renderers/DarkMatterRenderer.js');
    return DarkMatterRenderer;
  },
  redshift: async () => {
    const { RedshiftRenderer } = await import('../renderers/RedshiftRenderer.js');
    return RedshiftRenderer;
  },
  eventHorizon: async () => {
    const { EventHorizonRenderer } = await import('../renderers/EventHorizonRenderer.js');
    return EventHorizonRenderer;
  },
  rocheLimit: async () => {
    const { RocheLimitRenderer } = await import('../renderers/RocheLimitRenderer.js');
    return RocheLimitRenderer;
  },
  gravitationalWave: async () => {
    const { GravitationalWaveRenderer } = await import('../renderers/GravitationalWaveRenderer.js');
    return GravitationalWaveRenderer;
  }
};

export class SceneRouter {
  constructor(canvas) {
    this.canvas = canvas;
    this.currentScene = null;
    this.currentData = null;
    this.isTransitioning = false;
  }

  async mount(memoryData, options = {}) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    try {
      if (this.currentScene) {
        if (options.transition === 'collapse') {
          await this.playCollapseTransition();
        }
        this.currentScene.destroy();
        this.currentScene = null;
        this.currentData = null;
      }

      const celestialType = memoryData.celestialType;
      const rendererFactory = RendererRegistry[celestialType];

      if (!rendererFactory) {
        throw new Error(`Unknown celestial type: ${celestialType}`);
      }

      const RendererClass = await rendererFactory();

      const qualitySettings = options.quality || { antialias: true };

      const renderer = new RendererClass(this.canvas, memoryData, qualitySettings);

      await renderer.init();

      renderer.start();

      if (options.transition === 'wormhole') {
        await this.playWormholeEntry();
      }

      this.currentScene = renderer;
      this.currentData = memoryData;

      window.dispatchEvent(new CustomEvent('sceneMounted', {
        detail: { memoryData, scene: renderer }
      }));
    } catch (error) {
      console.error('SceneRouter mount error:', error);
      window.dispatchEvent(new CustomEvent('sceneError', {
        detail: { error, memoryData }
      }));
    } finally {
      this.isTransitioning = false;
    }
  }

  getCurrentScene() {
    return this.currentScene;
  }

  getCurrentData() {
    return this.currentData;
  }

  handleInput(eventType, data) {
    if (!this.currentScene) return;

    switch (eventType) {
      case 'scroll':
        this.currentScene.onScroll(data.deltaY, data.deltaX);
        break;
      case 'dragStart':
        this.currentScene.onDragStart(data.x, data.y);
        break;
      case 'drag':
        this.currentScene.onDrag(
          data.deltaX,
          data.deltaY,
          data.startX,
          data.startY,
          data.currentX,
          data.currentY
        );
        break;
      case 'dragEnd':
        this.currentScene.onDragEnd(data.totalDeltaX, data.totalDeltaY);
        break;
      case 'tap':
        this.currentScene.onTap(data.x, data.y);
        break;
      case 'pinch':
        this.currentScene.onPinch(data.scale, data.centerX, data.centerY);
        break;
    }
  }

  handleResize(width, height) {
    if (this.currentScene) {
      this.currentScene.onResize(width, height);
    }
  }

  async playCollapseTransition() {
    return new Promise(resolve => {
      setTimeout(resolve, 800);
    });
  }

  async playWormholeEntry() {
    return new Promise(resolve => {
      setTimeout(resolve, 600);
    });
  }

  destroy() {
    if (this.currentScene) {
      this.currentScene.destroy();
      this.currentScene = null;
    }
    this.currentData = null;
    this.isTransitioning = false;
  }
}
