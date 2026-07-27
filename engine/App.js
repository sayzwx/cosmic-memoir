import { SceneRouter } from './core/SceneRouter.js';
import { InputAdapter } from './core/InputAdapter.js';
import { DataLoader } from './core/DataLoader.js';
import { PerformanceProfiler } from './core/PerformanceProfiler.js';

export class CosmicMemoirApp {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      throw new Error(`Canvas element with id "${canvasId}" not found`);
    }

    this.router = new SceneRouter(this.canvas);
    this.input = new InputAdapter(this.canvas);
    this.data = new DataLoader();
    this.profiler = new PerformanceProfiler();

    this.universeData = null;
    this.currentChapter = -1;
    this.currentMemoryIndex = 0;
    this.currentMemories = [];

    this._resizeTimer = null;

    this.bindInput();
    this.bindResize();
  }

  async init() {
    this.universeData = await this.data.loadUniverse();

    this.profiler.measure();
    this.profiler.on('qualityChange', ({ quality }) => {
      if (this.router.currentScene) {
        this.router.currentScene.onQualityChange(quality);
      }
    });

    await this.loadChapter(0);
  }

  async loadChapter(chapterIndex) {
    this.currentChapter = chapterIndex;
    this.currentMemoryIndex = 0;

    this.currentMemories = await this.data.getMemoriesByChapter(chapterIndex);

    if (this.currentMemories.length === 0) {
      const nextChapter = chapterIndex + 1;
      const nextMemories = await this.data.getMemoriesByChapter(nextChapter);

      if (nextMemories.length === 0) {
        window.dispatchEvent(new CustomEvent('memoirComplete'));
        return;
      }

      await this.loadChapter(nextChapter);
      return;
    }

    await this.data.preloadImages(this.currentMemories);

    const transition = chapterIndex === 0 ? 'wormhole' : 'collapse';

    await this.router.mount(this.currentMemories[0], {
      transition,
      quality: this.profiler.getSettings()
    });
  }

  async nextMemory() {
    if (this.router.isTransitioning) return;

    this.currentMemoryIndex++;

    if (this.currentMemoryIndex >= this.currentMemories.length) {
      const nextChapter = this.currentChapter + 1;
      const nextMemories = await this.data.getMemoriesByChapter(nextChapter);

      if (nextMemories.length === 0) {
        window.dispatchEvent(new CustomEvent('memoirComplete'));
        return;
      }

      await this.loadChapter(nextChapter);
      return;
    }

    await this.router.mount(this.currentMemories[this.currentMemoryIndex], {
      transition: 'wormhole',
      quality: this.profiler.getSettings()
    });
  }

  async prevMemory() {
    if (this.router.isTransitioning) return;

    if (this.currentMemoryIndex > 0) {
      this.currentMemoryIndex--;
      await this.router.mount(this.currentMemories[this.currentMemoryIndex], {
        transition: 'collapse',
        quality: this.profiler.getSettings()
      });
      return;
    }

    if (this.currentChapter > 0) {
      const prevChapter = this.currentChapter - 1;
      const prevMemories = await this.data.getMemoriesByChapter(prevChapter);

      if (prevMemories.length > 0) {
        this.currentChapter = prevChapter;
        this.currentMemoryIndex = prevMemories.length - 1;
        this.currentMemories = prevMemories;

        await this.router.mount(this.currentMemories[this.currentMemoryIndex], {
          transition: 'collapse',
          quality: this.profiler.getSettings()
        });
      }
    }
  }

  bindInput() {
    this.input.on('scroll', (data) => {
      this.router.handleInput('scroll', data);
    });

    this.input.on('dragStart', (data) => {
      this.router.handleInput('dragStart', data);
    });

    this.input.on('drag', (data) => {
      this.router.handleInput('drag', data);
    });

    this.input.on('dragEnd', (data) => {
      this.router.handleInput('dragEnd', data);
    });

    this.input.on('tap', (data) => {
      this.router.handleInput('tap', data);
    });

    this.input.on('pinch', (data) => {
      this.router.handleInput('pinch', data);
    });
  }

  bindResize() {
    window.addEventListener('resize', () => {
      if (this._resizeTimer) {
        clearTimeout(this._resizeTimer);
      }

      this._resizeTimer = setTimeout(() => {
        const width = this.canvas.clientWidth || window.innerWidth;
        const height = this.canvas.clientHeight || window.innerHeight;
        this.router.handleResize(width, height);
      }, 250);
    });
  }

  destroy() {
    if (this._resizeTimer) {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = null;
    }

    this.profiler.stop();
    this.router.destroy();
    this.input.destroy();
    this.data.clearCache();
  }
}
