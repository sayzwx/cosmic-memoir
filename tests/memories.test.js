/**
 * memories.json 数据完整性测试
 *
 * 直接读取 data/memories.json 验证：
 * - 所有 memory id 匹配正则 ^mem_[0-9]{4}_[a-z]+$
 * - chapterIndex 范围 0-4
 * - 每种 celestialType 至少 1 条记忆
 * - 每条记忆的 physicsParams 包含与 celestialType 同名的嵌套 key
 * - narrative 包含 prologueText, bodyText, epilogueText
 * - emotionalTemperature 范围 1000-12000（如存在）
 * - meta.title 存在且非空
 * - celestialType 是 5 种合法值之一
 */

import { describe, it, expect } from 'vitest';
import memoriesData from '../data/memories.json';

const VALID_CELESTIAL_TYPES = [
  'darkMatter',
  'redshift',
  'eventHorizon',
  'rocheLimit',
  'gravitationalWave'
];

const ID_PATTERN = /^mem_[0-9]{4}_[a-z]+$/;

describe('memories.json data integrity', () => {
  const memories = memoriesData.memories;

  it('test_has8Memories', () => {
    expect(memories).toHaveLength(8);
  });

  it('test_hasUniverseConfig', () => {
    expect(memoriesData.universeConfig).toBeDefined();
    expect(memoriesData.universeConfig.globalConstants).toBeDefined();
    expect(memoriesData.universeConfig.theme).toBeDefined();
  });

  // ─── ID 格式 ───

  it('test_allMemoryIds_matchPattern', () => {
    memories.forEach(memory => {
      expect(memory.id).toMatch(ID_PATTERN);
    });
  });

  // ─── chapterIndex 范围 ───

  it('test_allChapterIndicesInRange0to4', () => {
    memories.forEach(memory => {
      const idx = memory.meta.chapterIndex;
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThanOrEqual(4);
      expect(Number.isInteger(idx)).toBe(true);
    });
  });

  it('test_all5ChaptersHaveMemories', () => {
    const chapters = new Set(memories.map(m => m.meta.chapterIndex));
    expect(chapters.size).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(chapters.has(i)).toBe(true);
    }
  });

  // ─── celestialType ───

  it('test_allCelestialTypesAreValid', () => {
    memories.forEach(memory => {
      expect(VALID_CELESTIAL_TYPES).toContain(memory.celestialType);
    });
  });

  it('test_eachCelestialTypeHasAtLeastOneMemory', () => {
    VALID_CELESTIAL_TYPES.forEach(type => {
      const count = memories.filter(m => m.celestialType === type).length;
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── physicsParams 嵌套结构 ───

  it('test_physicsParamsContainsMatchingCelestialTypeKey', () => {
    memories.forEach(memory => {
      expect(memory.physicsParams).toBeDefined();
      expect(memory.physicsParams[memory.celestialType]).toBeDefined();
      expect(typeof memory.physicsParams[memory.celestialType]).toBe('object');
    });
  });

  it('test_eventHorizon_hasSchwarzschildRadius', () => {
    const eventHorizonMemories = memories.filter(m => m.celestialType === 'eventHorizon');
    eventHorizonMemories.forEach(memory => {
      expect(memory.physicsParams.eventHorizon.schwarzschildRadius).toBeDefined();
      expect(typeof memory.physicsParams.eventHorizon.schwarzschildRadius).toBe('number');
    });
  });

  // ─── narrative 完整性 ───

  it('test_allNarrativesHaveRequiredFields', () => {
    memories.forEach(memory => {
      expect(memory.narrative).toBeDefined();
      expect(memory.narrative.prologueText).toBeDefined();
      expect(typeof memory.narrative.prologueText).toBe('string');
      expect(memory.narrative.prologueText.length).toBeGreaterThan(0);

      expect(memory.narrative.bodyText).toBeDefined();
      expect(typeof memory.narrative.bodyText).toBe('string');
      expect(memory.narrative.bodyText.length).toBeGreaterThan(0);

      expect(memory.narrative.epilogueText).toBeDefined();
      expect(typeof memory.narrative.epilogueText).toBe('string');
      expect(memory.narrative.epilogueText.length).toBeGreaterThan(0);
    });
  });

  // ─── emotionalTemperature ───

  it('test_emotionalTemperatureInRange', () => {
    memories.forEach(memory => {
      if (memory.meta.emotionalTemperature !== undefined) {
        const temp = memory.meta.emotionalTemperature;
        expect(temp).toBeGreaterThanOrEqual(1000);
        expect(temp).toBeLessThanOrEqual(12000);
      }
    });
  });

  it('test_allMemoriesHaveEmotionalTemperature', () => {
    memories.forEach(memory => {
      expect(memory.meta.emotionalTemperature).toBeDefined();
      expect(typeof memory.meta.emotionalTemperature).toBe('number');
    });
  });

  // ─── meta.title ───

  it('test_allMetaTitlesExistAndNonEmpty', () => {
    memories.forEach(memory => {
      expect(memory.meta.title).toBeDefined();
      expect(typeof memory.meta.title).toBe('string');
      expect(memory.meta.title.length).toBeGreaterThan(0);
    });
  });

  // ─── meta.order ───

  it('test_allMemoriesHaveOrder', () => {
    memories.forEach(memory => {
      expect(memory.meta.order).toBeDefined();
      expect(typeof memory.meta.order).toBe('number');
    });
  });

  it('test_orderUniqueWithinChapter', () => {
    // 每个章节内的 order 应唯一
    for (let ch = 0; ch < 5; ch++) {
      const chapterMemories = memories.filter(m => m.meta.chapterIndex === ch);
      const orders = chapterMemories.map(m => m.meta.order);
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBe(orders.length);
    }
  });

  // ─── interactionConfig ───

  it('test_allMemoriesHaveInteractionConfig', () => {
    memories.forEach(memory => {
      expect(memory.interactionConfig).toBeDefined();
      expect(memory.interactionConfig.entryTrigger).toBeDefined();
      expect(memory.interactionConfig.cameraStart).toBeDefined();
      expect(memory.interactionConfig.cameraStart.position).toBeDefined();
    });
  });

  // ─── isHidden ───

  it('test_isHiddenIsBoolean', () => {
    memories.forEach(memory => {
      if (memory.meta.isHidden !== undefined) {
        expect(typeof memory.meta.isHidden).toBe('boolean');
      }
    });
  });

  it('test_atLeastOneHiddenMemory', () => {
    const hiddenCount = memories.filter(m => m.meta.isHidden === true).length;
    expect(hiddenCount).toBeGreaterThanOrEqual(1);
  });

  // ─── 唯一 ID ───

  it('test_allMemoryIdsAreUnique', () => {
    const ids = memories.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('test_m8PhotoRolesAreCompleteAndUnique', () => {
    const memory = memories.find(item => item.id === 'mem_1995_shadow');
    const photos = memory.media.photos;
    const expectedRoles = ['cover', 'letter', 'hiddenMemory', 'lensReflection', 'epilogue'];

    expect(photos).toHaveLength(expectedRoles.length);
    expect(new Set(photos.map(photo => photo.role))).toEqual(new Set(expectedRoles));
    photos.forEach(photo => {
      expect(photo.src).toMatch(/^\.\/assets\/memories\/m8\/.+\.(svg|webp|avif)$/);
      expect(photo.alt.trim().length).toBeGreaterThan(0);
      expect(photo.caption.trim().length).toBeGreaterThan(0);
    });
  });

  it('test_m8DeclaresExplicitSpatialMemoryV2Experience', () => {
    const memory = memories.find(item => item.id === 'mem_1995_shadow');
    const ids = memory.media.photos.map(photo => photo.id);

    expect(memory.experience).toEqual({
      id: 'M8',
      variant: 'deepSpaceSpatialMemory',
      version: 2,
      entityOrder: ids
    });
    expect(memories.filter(item => item.experience?.id === 'M8')).toHaveLength(1);
  });

  it('test_m8HasExactlyFiveCompleteSpatialEntities', () => {
    const memory = memories.find(item => item.experience?.id === 'M8');
    const photos = memory.media.photos;

    expect(photos).toHaveLength(5);
    expect(new Set(photos.map(photo => photo.id)).size).toBe(5);
    photos.forEach(photo => {
      ['id', 'title', 'body', 'role', 'src', 'alt', 'caption', 'accent'].forEach(field => {
        expect(typeof photo[field]).toBe('string');
        expect(photo[field].trim().length).toBeGreaterThan(0);
      });
      expect(photo.position).toHaveLength(3);
      expect(photo.rotation).toHaveLength(3);
      expect(photo.size).toHaveLength(2);
      expect(photo.focusOffset).toHaveLength(3);
      expect([...photo.position, ...photo.rotation, ...photo.size, ...photo.focusOffset]
        .every(Number.isFinite)).toBe(true);
      expect(photo.size.every(value => value > 0)).toBe(true);
      expect(Array.isArray(photo.unlockAfter)).toBe(true);
      expect(photo.lensingStrength).toBeGreaterThanOrEqual(0);
      expect(typeof photo.discovery.type).toBe('string');
    });
  });

  it('test_m8UnlockGraphReferencesEntitiesAndIsAcyclic', () => {
    const photos = memories.find(item => item.experience?.id === 'M8').media.photos;
    const dependencies = new Map(photos.map(photo => [photo.id, photo.unlockAfter]));
    dependencies.forEach(required => required.forEach(id => expect(dependencies.has(id)).toBe(true)));
    const visiting = new Set();
    const visited = new Set();
    const visit = id => {
      expect(visiting.has(id)).toBe(false);
      if (visited.has(id)) return;
      visiting.add(id);
      dependencies.get(id).forEach(visit);
      visiting.delete(id);
      visited.add(id);
    };
    dependencies.forEach((_, id) => visit(id));
    expect(visited.size).toBe(5);
  });

  it('test_m8KeepsLocalPhotoPathsAndLegacyMediaFields', () => {
    const memory = memories.find(item => item.experience?.id === 'M8');
    expect(memory.media.hiddenMemoryId).toBe('mem_1998_humidity');
    expect(memory.media.photos.map(photo => photo.src)).toEqual([
      './assets/memories/m8/cover-orbit.svg',
      './assets/memories/m8/letter-window.svg',
      './assets/memories/m8/hidden-summer.svg',
      './assets/memories/m8/lens-reflection.svg',
      './assets/memories/m8/epilogue-dawn.svg'
    ]);
    memory.media.photos.forEach(photo => {
      expect(photo).toHaveProperty('role');
      expect(photo).toHaveProperty('alt');
      expect(photo).toHaveProperty('caption');
    });
  });

  it('test_m8HiddenMemoryReferenceIsValid', () => {
    const memory = memories.find(item => item.id === 'mem_1995_shadow');
    const hidden = memories.find(item => item.id === memory.media.hiddenMemoryId);

    expect(hidden).toBeDefined();
    expect(hidden.meta.isHidden).toBe(true);
    expect(hidden.meta.chapterIndex).toBe(memory.meta.chapterIndex);
  });
});
