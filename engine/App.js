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
    this._navigationLocked = false;
    this._onResize = null;

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
    const memories = await this.data.getMemoriesByChapter(chapterIndex);

    if (memories.length === 0) {
      const nextChapter = chapterIndex + 1;
      const nextMemories = await this.data.getMemoriesByChapter(nextChapter);

      if (nextMemories.length === 0) {
        window.dispatchEvent(new CustomEvent('memoirComplete'));
        return;
      }

      await this.loadChapter(nextChapter);
      return;
    }

    await this.data.preloadImages(memories);

    const transition = chapterIndex === 0 ? 'wormhole' : 'collapse';

    this.currentChapter = chapterIndex;
    this.currentMemoryIndex = 0;
    this.currentMemories = memories;
    const mounted = await this.router.mount(memories[0], {
      transition,
      quality: { ...this.profiler.getSettings(), quality: this.profiler.quality }
    });
    return mounted;
  }

  async nextMemory() {
    if (this.router.isTransitioning || this._navigationLocked) return;
    this._navigationLocked = true;
    try {
      const targetIndex = this.currentMemoryIndex + 1;
      if (targetIndex >= this.currentMemories.length) {
      const nextChapter = this.currentChapter + 1;
      const nextMemories = await this.data.getMemoriesByChapter(nextChapter);

      if (nextMemories.length === 0) {
        window.dispatchEvent(new CustomEvent('memoirComplete'));
        return;
      }

      await this.loadChapter(nextChapter);
      return;
      }

    const previousIndex = this.currentMemoryIndex;
    this.currentMemoryIndex = targetIndex;
    const mounted = await this.router.mount(this.currentMemories[targetIndex], {
      transition: 'wormhole',
      quality: { ...this.profiler.getSettings(), quality: this.profiler.quality }
    });
    if (!mounted) this.currentMemoryIndex = previousIndex;
    } finally {
      this._navigationLocked = false;
    }
  }

  async prevMemory() {
    if (this.router.isTransitioning || this._navigationLocked) return;
    this._navigationLocked = true;
    try {

    if (this.currentMemoryIndex > 0) {
      const targetIndex = this.currentMemoryIndex - 1;
      const previousIndex = this.currentMemoryIndex;
      this.currentMemoryIndex = targetIndex;
      const mounted = await this.router.mount(this.currentMemories[targetIndex], {
        transition: 'collapse',
        quality: { ...this.profiler.getSettings(), quality: this.profiler.quality }
      });
      if (!mounted) this.currentMemoryIndex = previousIndex;
      return;
    }

    if (this.currentChapter > 0) {
      const prevChapter = this.currentChapter - 1;
      const prevMemories = await this.data.getMemoriesByChapter(prevChapter);

      if (prevMemories.length > 0) {
        const targetIndex = prevMemories.length - 1;
        const previousState = {
          chapter: this.currentChapter,
          index: this.currentMemoryIndex,
          memories: this.currentMemories
        };
        this.currentChapter = prevChapter;
        this.currentMemoryIndex = targetIndex;
        this.currentMemories = prevMemories;
        const mounted = await this.router.mount(prevMemories[targetIndex], {
          transition: 'collapse',
          quality: { ...this.profiler.getSettings(), quality: this.profiler.quality }
        });
        if (!mounted) {
          this.currentChapter = previousState.chapter;
          this.currentMemoryIndex = previousState.index;
          this.currentMemories = previousState.memories;
        }
      }
    }
    } finally {
      this._navigationLocked = false;
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
    this._onResize = () => {
      if (this._resizeTimer) {
        clearTimeout(this._resizeTimer);
      }

      this._resizeTimer = setTimeout(() => {
        const width = this.canvas.clientWidth || window.innerWidth;
        const height = this.canvas.clientHeight || window.innerHeight;
        this.router.handleResize(width, height);
      }, 250);
    };
    window.addEventListener('resize', this._onResize);
  }

  destroy() {
    if (this._resizeTimer) {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = null;
    }

    this.profiler.stop();
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    this._onResize = null;
    this.router.destroy();
    this.input.destroy();
    this.data.clearCache();
  }
}
