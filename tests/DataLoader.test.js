/**
 * DataLoader.js 测试
 *
 * 测试覆盖：
 * - loadUniverse() 正确 fetch JSON 并缓存（第二次调用不 fetch）
 * - getMemoriesByChapter(chapterIndex) 返回正确章节记忆（过滤 isHidden + sort by order）
 * - getMemoryById(id) 返回正确记忆
 * - getConfig() 返回 universeConfig
 * - clearCache() 清空缓存
 * - isHidden 记忆被 getMemoriesByChapter 过滤
 * - fetch 失败时抛出错误
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataLoader } from '../engine/core/DataLoader.js';
import memoriesData from '../data/memories.json';

describe('DataLoader', () => {
  let loader;
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    loader = new DataLoader('./data');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** 辅助：创建一个成功的 fetch Response mock */
  function mockOkResponse(data) {
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve(data)
    };
  }

  /** 辅助：创建一个失败的 fetch Response mock */
  function mockBadResponse(status, statusText) {
    return {
      ok: false,
      status: status,
      statusText: statusText,
      json: () => Promise.resolve({})
    };
  }

  it('test_loadUniverse_fetchesAndReturnsData', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    const result = await loader.loadUniverse();

    expect(result).toEqual(memoriesData);
    expect(result.memories).toHaveLength(8);
    expect(result.universeConfig).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith('./data/memories.json');
  });

  it('test_loadUniverse_cachesOnSecondCall', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    await loader.loadUniverse();
    await loader.loadUniverse();

    // 第二次调用不应再 fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('test_getMemoriesByChapter0_filtersHiddenAndSortsByOrder', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    const chapter0 = await loader.getMemoriesByChapter(0);

    // 章节 0 有 2 条记忆：mem_1998_humidity (isHidden=true, order=1) 和 mem_1995_shadow (isHidden=false, order=2)
    // 过滤 isHidden 后应只剩 1 条
    expect(chapter0).toHaveLength(1);
    expect(chapter0[0].id).toBe('mem_1995_shadow');
  });

  it('test_getMemoriesByChapter2_returnsEventHorizonMemories', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    const chapter2 = await loader.getMemoriesByChapter(2);

    // 章节 2 有 2 条记忆，都是 eventHorizon 类型，都不是 hidden
    expect(chapter2).toHaveLength(2);
    // 按 order 排序：mem_2012_silence (order=1), mem_2008_farewell (order=2)
    expect(chapter2[0].id).toBe('mem_2012_silence');
    expect(chapter2[1].id).toBe('mem_2008_farewell');
    // 验证 celestialType
    expect(chapter2.every(m => m.celestialType === 'eventHorizon')).toBe(true);
  });

  it('test_getMemoriesByChapter_sortedByOrder', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    const chapter1 = await loader.getMemoriesByChapter(1);

    // 章节 1 有 2 条记忆，order 分别为 1 和 2
    expect(chapter1).toHaveLength(2);
    expect(chapter1[0].meta.order).toBeLessThanOrEqual(chapter1[1].meta.order);
  });

  it('test_getMemoryById_returnsCorrectMemory', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    const memory = await loader.getMemoryById('mem_2015_resonance');

    expect(memory).not.toBeNull();
    expect(memory.id).toBe('mem_2015_resonance');
    expect(memory.celestialType).toBe('gravitationalWave');
    expect(memory.meta.title).toBe('周期性发作的执念');
    expect(memory.physicsParams.gravitationalWave).toBeDefined();
  });

  it('test_getMemoryById_nonExistentReturnsNull', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    const memory = await loader.getMemoryById('mem_9999_nonexistent');

    expect(memory).toBeNull();
  });

  it('test_getConfig_returnsUniverseConfig', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    const config = await loader.getConfig();

    expect(config).toEqual(memoriesData.universeConfig);
    expect(config.globalConstants).toBeDefined();
    expect(config.globalConstants.G).toBe(6.674);
    expect(config.theme).toBeDefined();
  });

  it('test_clearCache_emptiesCache', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    // 第一次加载
    await loader.loadUniverse();
    expect(loader.cache.has('universe')).toBe(true);
    expect(loader.universeConfig).not.toBeNull();

    // 清空缓存
    loader.clearCache();
    expect(loader.cache.has('universe')).toBe(false);
    expect(loader.universeConfig).toBeNull();
  });

  it('test_clearCache_nextLoadRefetches', async () => {
    fetchMock.mockResolvedValue(mockOkResponse(memoriesData));

    await loader.loadUniverse();
    loader.clearCache();
    await loader.loadUniverse();

    // 清空后再加载应该重新 fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('test_isHiddenMemory_filteredByGetMemoriesByChapter', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    // mem_1998_humidity 是 isHidden=true 的记忆
    const chapter0 = await loader.getMemoriesByChapter(0);
    const hiddenMemory = chapter0.find(m => m.id === 'mem_1998_humidity');

    expect(hiddenMemory).toBeUndefined();
  });

  it('test_isHiddenMemory_includedInGetAllMemoriesByChapter', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    // getAllMemoriesByChapter 不应过滤 isHidden
    const chapter0 = await loader.getAllMemoriesByChapter(0);
    const hiddenMemory = chapter0.find(m => m.id === 'mem_1998_humidity');

    expect(hiddenMemory).toBeDefined();
    expect(chapter0).toHaveLength(2);
  });

  it('test_fetchFailure_throwsError', async () => {
    fetchMock.mockResolvedValueOnce(mockBadResponse(404, 'Not Found'));

    await expect(loader.loadUniverse()).rejects.toThrow('Failed to load universe data: 404 Not Found');
  });

  it('test_fetchNetworkError_throwsError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    await expect(loader.loadUniverse()).rejects.toThrow('Network error');
  });

  it('test_getMemoriesByChapter_emptyChapter_returnsEmptyArray', async () => {
    fetchMock.mockResolvedValueOnce(mockOkResponse(memoriesData));

    // 章节 999 不存在
    const result = await loader.getMemoriesByChapter(999);

    expect(result).toEqual([]);
  });

  it('test_preloadImages_emptyList_returnsEmptyArray', async () => {
    const results = await loader.preloadImages([]);

    expect(results).toEqual([]);
  });

  it('test_preloadImages_memoriesWithoutImages_returnsEmptyArray', async () => {
    // 所有记忆的 media 都没有 images/thumbnail
    const results = await loader.preloadImages(memoriesData.memories);

    expect(results).toEqual([]);
  });
});
