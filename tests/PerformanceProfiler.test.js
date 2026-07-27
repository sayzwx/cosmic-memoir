/**
 * PerformanceProfiler.js 测试
 *
 * 测试覆盖：
 * - 初始 quality 为 'high'
 * - 模拟低 FPS（< 40）-> 降级到 'medium'
 * - 模拟更低 FPS（< 20）-> 降级到 'low'
 * - 高 FPS（>= 40）-> 保持 'high'
 * - getSettings() 返回正确的配置对象（high/medium/low 三种）
 * - on('qualityChange', cb) 在降级时被调用
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceProfiler } from '../engine/core/PerformanceProfiler.js';

describe('PerformanceProfiler', () => {
  let profiler;
  let rafQueue;
  let mockTime;

  beforeEach(() => {
    rafQueue = [];
    mockTime = 0;

    // Mock requestAnimationFrame：将回调放入队列而非自动执行
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    // Mock performance.now()：返回可控的时间值
    vi.stubGlobal('performance', { now: () => mockTime });

    profiler = new PerformanceProfiler();
  });

  afterEach(() => {
    if (profiler) profiler.stop();
    vi.unstubAllGlobals();
  });

  /**
   * 辅助：模拟指定帧数的采样
   * @param {number} count - 帧数
   * @param {number} frameDeltaMs - 每帧间隔（毫秒）
   */
  function simulateFrames(count, frameDeltaMs) {
    profiler.measure(); // 开始测量，设置 lastSampleTime = 0，push 第一个 raf
    for (let i = 0; i < count; i++) {
      mockTime += frameDeltaMs;
      const cb = rafQueue.shift();
      if (cb) cb();
    }
    profiler.stop();
  }

  // ─── 初始状态 ───

  it('test_initialQuality_isHigh', () => {
    expect(profiler.quality).toBe('high');
  });

  it('test_initialFps_is60', () => {
    expect(profiler.fps).toBe(60);
  });

  // ─── 降级逻辑 ───

  it('test_lowFps_below20_degradesToLow', () => {
    // 每帧 55ms -> fps = 1000/55 ≈ 18.18 < 20 -> low
    simulateFrames(30, 55);

    expect(profiler.quality).toBe('low');
  });

  it('test_mediumFps_below40_degradesToMedium', () => {
    // 每帧 30ms -> fps = 1000/30 ≈ 33.33 < 40 且 >= 20 -> medium
    simulateFrames(30, 30);

    expect(profiler.quality).toBe('medium');
  });

  it('test_highFps_above40_staysHigh', () => {
    // 每帧 16ms -> fps = 1000/16 = 62.5 >= 40 -> high
    simulateFrames(30, 16);

    expect(profiler.quality).toBe('high');
  });

  it('test_exactFps20_degradesToMedium', () => {
    // 每帧 50ms -> fps = 1000/50 = 20 -> 不满足 < 20，但满足 < 40 -> medium
    simulateFrames(30, 50);

    expect(profiler.quality).toBe('medium');
  });

  it('test_exactFps40_staysHigh', () => {
    // 每帧 25ms -> fps = 1000/25 = 40 -> 不满足 < 40 -> high
    simulateFrames(30, 25);

    expect(profiler.quality).toBe('high');
  });

  // ─── getSettings ───

  it('test_getSettings_highQuality_returnsCorrectConfig', () => {
    const settings = profiler.getSettings();

    expect(settings).toEqual({
      particleCount: 1.0,
      shadowQuality: 1.0,
      bloom: true,
      antialias: true
    });
  });

  it('test_getSettings_mediumQuality_returnsCorrectConfig', () => {
    simulateFrames(30, 30); // -> medium

    const settings = profiler.getSettings();

    expect(settings).toEqual({
      particleCount: 0.5,
      shadowQuality: 0.5,
      bloom: true,
      antialias: false
    });
  });

  it('test_getSettings_lowQuality_returnsCorrectConfig', () => {
    simulateFrames(30, 55); // -> low

    const settings = profiler.getSettings();

    expect(settings).toEqual({
      particleCount: 0.2,
      shadowQuality: 0.2,
      bloom: false,
      antialias: false
    });
  });

  // ─── qualityChange 事件 ───

  it('test_qualityChange_firesOnDowngradeToMedium', () => {
    const cb = vi.fn();
    profiler.on('qualityChange', cb);

    simulateFrames(30, 30); // high -> medium

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 'medium' })
    );
  });

  it('test_qualityChange_firesOnDowngradeToLow', () => {
    const cb = vi.fn();
    profiler.on('qualityChange', cb);

    simulateFrames(30, 55); // high -> low

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 'low' })
    );
  });

  it('test_qualityChange_doesNotFireWhenQualityUnchanged', () => {
    const cb = vi.fn();
    profiler.on('qualityChange', cb);

    simulateFrames(30, 16); // high -> high (no change)

    expect(cb).not.toHaveBeenCalled();
  });

  it('test_qualityChange_payloadIncludesFps', () => {
    const cb = vi.fn();
    profiler.on('qualityChange', cb);

    simulateFrames(30, 30); // -> medium

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: 'medium',
        fps: expect.any(Number)
      })
    );
    // fps 应该约等于 1000/30 ≈ 33.33
    const callArg = cb.mock.calls[0][0];
    expect(callArg.fps).toBeCloseTo(1000 / 30, 0);
  });

  // ─── on/off 事件系统 ───

  it('test_off_removesCallback', () => {
    const cb = vi.fn();
    profiler.on('qualityChange', cb);
    profiler.off('qualityChange', cb);

    simulateFrames(30, 30);

    expect(cb).not.toHaveBeenCalled();
  });

  // ─── measure / stop ───

  it('test_stop_setsIsMeasuringFalse', () => {
    profiler.measure();
    expect(profiler.isMeasuring).toBe(true);

    profiler.stop();
    expect(profiler.isMeasuring).toBe(false);
  });

  it('test_measure_calledTwice_doesNotRestart', () => {
    profiler.measure();
    const firstRafCount = rafQueue.length;

    profiler.measure(); // 不应重新启动

    expect(rafQueue.length).toBe(firstRafCount);
  });

  it('test_stop_cancelsAnimationFrame', () => {
    const cancelSpy = vi.mocked(cancelAnimationFrame);
    profiler.measure();
    profiler.stop();

    expect(cancelSpy).toHaveBeenCalled();
  });
});
