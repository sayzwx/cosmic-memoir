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
    this.validateUniverse(data);
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
        if (memory.media.primaryImage) {
          imageUrls.push(memory.media.primaryImage);
        }
        if (Array.isArray(memory.media.secondaryImages)) {
          imageUrls.push(...memory.media.secondaryImages);
        }
        if (Array.isArray(memory.media.images)) {
          imageUrls.push(...memory.media.images);
        }
        if (memory.media.thumbnail) {
          imageUrls.push(memory.media.thumbnail);
        }
        if (Array.isArray(memory.media.photos)) {
          memory.media.photos.forEach(photo => {
            if (photo?.src) imageUrls.push(photo.src);
            if (photo?.previewSrc) imageUrls.push(photo.previewSrc);
          });
        }
      }
    });

    if (imageUrls.length === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      [...new Set(imageUrls)].map(url => {
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

  getPhotoByRole(memory, role) {
    const photos = memory?.media?.photos;
    if (!Array.isArray(photos)) return null;
    return photos.find(photo => photo?.role === role && photo.src) || null;
  }

  async getHiddenMemory(memory) {
    const id = memory?.media?.hiddenMemoryId;
    if (!id) return null;
    const hiddenMemory = await this.getMemoryById(id);
    return hiddenMemory?.meta?.isHidden ? hiddenMemory : null;
  }

  validateUniverse(data) {
    if (!data || !Array.isArray(data.memories)) {
      throw new Error('Invalid universe data: memories must be an array');
    }
    data.memories.forEach(memory => {
      if (memory?.experience?.id === 'M8' ||
          memory?.experience?.variant === 'deepSpaceSpatialMemory') {
        this.validateSpatialMemoryV2(memory);
      }
    });
    return true;
  }

  validateSpatialMemoryV2(memory) {
    const fail = message => {
      throw new Error(`Invalid spatial-memory v2 (${memory?.id || 'unknown'}): ${message}`);
    };
    const experience = memory?.experience;
    const photos = memory?.media?.photos;
    const carrierTypes = ['galacticCore', 'einsteinRing', 'cosmicWeb', 'planetaryMonument', 'epilogueSkybox'];
    if (!experience || experience.id !== 'M8' ||
        experience.variant !== 'deepSpaceSpatialMemory' || experience.version !== 2) {
      fail('experience must identify M8/deepSpaceSpatialMemory version 2');
    }
    if (!Array.isArray(photos) || photos.length !== 5) fail('exactly five photo entities are required');
    if (!Array.isArray(experience.entityOrder) || experience.entityOrder.length !== photos.length) {
      fail('entityOrder must contain every photo entity');
    }

    const ids = photos.map(photo => photo?.id);
    if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
      fail('photo entity ids must be non-empty and unique');
    }
    const carriers = photos.map(photo => photo?.carrier);
    if (carriers.some(carrier => typeof carrier !== 'string' || !carrier.trim())) {
      fail('carrier is required for every photo entity');
    }
    if (new Set(carriers).size !== carrierTypes.length ||
        carrierTypes.some(carrier => !carriers.includes(carrier))) {
      fail(`carriers must contain exactly one of each: ${carrierTypes.join(', ')}`);
    }
    if (new Set(experience.entityOrder).size !== ids.length ||
        experience.entityOrder.some(id => !ids.includes(id))) {
      fail('entityOrder must be a unique permutation of photo entity ids');
    }

    const vector = (value, length) => Array.isArray(value) && value.length === length &&
      value.every(Number.isFinite);
    photos.forEach(photo => {
      ['title', 'body', 'role', 'src', 'alt', 'caption', 'accent'].forEach(field => {
        if (typeof photo?.[field] !== 'string' || !photo[field].trim()) fail(`${photo?.id || 'photo'}.${field} is required`);
      });
      if (!vector(photo.position, 3) || !vector(photo.rotation, 3) ||
          !vector(photo.size, 2) || !vector(photo.focusOffset, 3)) {
        fail(`${photo.id} has invalid spatial vectors`);
      }
      if (photo.size.some(value => value <= 0)) fail(`${photo.id}.size values must be positive`);
      if (!Number.isFinite(photo.lensingStrength) || photo.lensingStrength < 0) {
        fail(`${photo.id}.lensingStrength must be a non-negative number`);
      }
      if (!Array.isArray(photo.unlockAfter)) fail(`${photo.id}.unlockAfter must be an array`);
      if (typeof photo.discovery?.type !== 'string' || !photo.discovery.type.trim()) {
        fail(`${photo.id}.discovery.type is required`);
      }
    });

    const dependencies = new Map(photos.map(photo => [photo.id, photo.unlockAfter]));
    dependencies.forEach((requiredIds, id) => requiredIds.forEach(requiredId => {
      if (!dependencies.has(requiredId)) fail(`${id}.unlockAfter references unknown entity ${requiredId}`);
      if (requiredId === id) fail(`${id} cannot unlock after itself`);
    }));
    const visiting = new Set();
    const visited = new Set();
    const visit = id => {
      if (visiting.has(id)) fail(`unlock graph contains a cycle at ${id}`);
      if (visited.has(id)) return;
      visiting.add(id);
      dependencies.get(id).forEach(visit);
      visiting.delete(id);
      visited.add(id);
    };
    ids.forEach(visit);
    return true;
  }

  clearCache() {
    this.cache.clear();
    this.universeConfig = null;
  }
}
