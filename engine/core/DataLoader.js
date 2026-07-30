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
        const photos = memory.media.crystalNodes ?? memory.media.photos;
        if (Array.isArray(photos)) {
          photos.forEach(photo => {
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
    const photos = memory?.media?.crystalNodes ?? memory?.media?.photos;
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
          memory?.experience?.variant === 'darkMatterCosmicWeb') {
        this.validateCrystalMemoryV3(memory);
      }
    });
    return true;
  }

  validateCrystalMemoryV3(memory) {
    const fail = message => {
      throw new Error(`Invalid M8 crystal-memory v3 (${memory?.id || 'unknown'}): ${message}`);
    };
    const experience = memory?.experience;
    const nodes = memory?.media?.crystalNodes;
    const crystalTypes = ['corePrism', 'twinLens', 'darkWebPrison', 'planetAnchor', 'finalSingularity'];
    if (!experience || experience.id !== 'M8' ||
        experience.variant !== 'darkMatterCosmicWeb' || experience.version !== 3) {
      fail('experience must identify M8/darkMatterCosmicWeb version 3');
    }
    if (!Array.isArray(nodes) || nodes.length !== 5) fail('exactly five crystal nodes are required');
    if (!Array.isArray(experience.entityOrder) || experience.entityOrder.length !== nodes.length) {
      fail('entityOrder must contain every crystal node');
    }

    const ids = nodes.map(node => node?.id);
    if (ids.some(id => typeof id !== 'string' || !id.trim()) || new Set(ids).size !== ids.length) {
      fail('crystal node ids must be non-empty and unique');
    }
    const configuredTypes = nodes.map(node => node?.crystalType);
    if (new Set(configuredTypes).size !== crystalTypes.length ||
        crystalTypes.some(type => !configuredTypes.includes(type))) {
      fail(`crystalType must contain exactly one of each: ${crystalTypes.join(', ')}`);
    }
    if (new Set(experience.entityOrder).size !== ids.length ||
        experience.entityOrder.some(id => !ids.includes(id))) {
      fail('entityOrder must be a unique permutation of crystal node ids');
    }

    const vector = (value, length) => Array.isArray(value) && value.length === length &&
      value.every(Number.isFinite);
    nodes.forEach(node => {
      ['title', 'body', 'role', 'src', 'alt', 'caption', 'energyColor', 'unfoldText'].forEach(field => {
        if (typeof node?.[field] !== 'string' || !node[field].trim()) fail(`${node?.id || 'node'}.${field} is required`);
      });
      if (!vector(node.position, 3) || !vector(node.rotation, 3) ||
          !vector(node.size, 2) || !vector(node.focusOffset, 3)) {
        fail(`${node.id} has invalid spatial vectors`);
      }
      if (node.size.some(value => value <= 0)) fail(`${node.id}.size values must be positive`);
      if (!Array.isArray(node.unlockAfter)) fail(`${node.id}.unlockAfter must be an array`);
      if (typeof node.discovery?.type !== 'string' || !node.discovery.type.trim()) {
        fail(`${node.id}.discovery.type is required`);
      }
    });

    const dependencies = new Map(nodes.map(node => [node.id, node.unlockAfter]));
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
    const finalNode = nodes.find(node => node.crystalType === 'finalSingularity');
    if (finalNode?.discovery?.requiresZoom !== true) fail('finalSingularity.discovery.requiresZoom must be true');
    if (finalNode?.hidden !== true) fail('finalSingularity must start hidden');
    if (nodes.some(node => node !== finalNode && node.hidden === true)) fail('only finalSingularity may start hidden');
    if (nodes.some(node => node.unlockAfter.length !== 0)) fail('all crystal nodes must start spatially unlocked');
    return true;
  }

  clearCache() {
    this.cache.clear();
    this.universeConfig = null;
  }
}
