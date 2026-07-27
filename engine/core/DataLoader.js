export class DataLoader {
  constructor(baseUrl = './data') {
    this.baseUrl = baseUrl;
    this.cache = new Map();
    this.universeConfig = null;
  }

  async loadUniverse() {
    if (this.cache.has('universe')) {
      const cached = this.cache.get('universe');
      this.universeConfig = cached.universeConfig || cached.config;
      return cached;
    }

    const response = await fetch(`${this.baseUrl}/memories.json`);
    if (!response.ok) {
      throw new Error(`Failed to load universe data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.cache.set('universe', data);
    this.universeConfig = data.universeConfig;
    return data;
  }

  async getMemoriesByChapter(chapterIndex) {
    const data = await this.loadUniverse();
    return data.memories
      .filter(m => m.meta.chapterIndex === chapterIndex && !m.meta.isHidden)
      .sort((a, b) => a.meta.order - b.meta.order);
  }

  async getAllMemoriesByChapter(chapterIndex) {
    const data = await this.loadUniverse();
    return data.memories
      .filter(m => m.meta.chapterIndex === chapterIndex)
      .sort((a, b) => a.meta.order - b.meta.order);
  }

  async getMemoryById(id) {
    const data = await this.loadUniverse();
    return data.memories.find(m => m.id === id) || null;
  }

  async getConfig() {
    if (!this.universeConfig) {
      await this.loadUniverse();
    }
    return this.universeConfig;
  }

  async preloadImages(memoryList) {
    const imageUrls = [];
    memoryList.forEach(memory => {
      if (memory.media) {
        if (Array.isArray(memory.media.images)) {
          imageUrls.push(...memory.media.images);
        }
        if (memory.media.thumbnail) {
          imageUrls.push(memory.media.thumbnail);
        }
      }
    });

    if (imageUrls.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      imageUrls.map(url => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(url);
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = url;
        });
      })
    );

    return results;
  }

  clearCache() {
    this.cache.clear();
    this.universeConfig = null;
  }
}
