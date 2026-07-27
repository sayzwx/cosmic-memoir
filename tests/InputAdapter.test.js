/**
 * InputAdapter.js 测试
 *
 * 测试覆盖：
 * - on('scroll', cb) + wheel 事件 -> cb 收到 {deltaY, deltaX}
 * - on('dragStart', cb) + mousedown -> cb 被调用
 * - on('drag', cb) + mousedown + mousemove -> cb 收到 deltaX/deltaY
 * - on('dragEnd', cb) + mouseup -> cb 收到 totalDeltaX/totalDeltaY
 * - on('tap', cb) + click（非拖拽）-> cb 被调用
 * - off() 取消订阅后 cb 不再被调用
 * - emit() 调用所有注册的回调
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputAdapter } from '../engine/core/InputAdapter.js';

describe('InputAdapter', () => {
  let element;
  let adapter;

  beforeEach(() => {
    // 创建一个真实的 DOM 元素（jsdom 提供）
    element = document.createElement('div');
    element.style.width = '500px';
    element.style.height = '500px';
    document.body.appendChild(element);

    adapter = new InputAdapter(element);
  });

  /** 辅助：触发 wheel 事件 */
  function dispatchWheel(deltaY, deltaX = 0, ctrlKey = false) {
    element.dispatchEvent(new WheelEvent('wheel', {
      deltaY,
      deltaX,
      ctrlKey,
      bubbles: true,
      cancelable: true
    }));
  }

  /** 辅助：触发 mousedown */
  function dispatchMouseDown(clientX, clientY) {
    element.dispatchEvent(new MouseEvent('mousedown', {
      clientX,
      clientY,
      bubbles: true,
      cancelable: true
    }));
  }

  /** 辅助：在 document 上触发 mousemove（InputAdapter 将 move/up 绑定在 document 上） */
  function dispatchMouseMove(clientX, clientY) {
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX,
      clientY,
      bubbles: true,
      cancelable: true
    }));
  }

  /** 辅助：在 document 上触发 mouseup */
  function dispatchMouseUp(clientX, clientY) {
    document.dispatchEvent(new MouseEvent('mouseup', {
      clientX,
      clientY,
      bubbles: true,
      cancelable: true
    }));
  }

  /** 辅助：在 element 上触发 click */
  function dispatchClick(clientX, clientY) {
    element.dispatchEvent(new MouseEvent('click', {
      clientX,
      clientY,
      bubbles: true,
      cancelable: true
    }));
  }

  // ─── scroll ───

  it('test_onScroll_wheelEvent_triggersCallback', () => {
    const cb = vi.fn();
    adapter.on('scroll', cb);

    dispatchWheel(100, 0, false);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ deltaY: 100, deltaX: 0, ctrlKey: false });
  });

  it('test_onScroll_wheelWithCtrlKey_passesCtrlKey', () => {
    const cb = vi.fn();
    adapter.on('scroll', cb);

    dispatchWheel(50, 10, true);

    expect(cb).toHaveBeenCalledWith({ deltaY: 50, deltaX: 10, ctrlKey: true });
  });

  // ─── dragStart ───

  it('test_onDragStart_mousedown_triggersCallback', () => {
    const cb = vi.fn();
    adapter.on('dragStart', cb);

    dispatchMouseDown(100, 200);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ x: 100, y: 200 });
  });

  // ─── drag ───

  it('test_onDrag_mousedownThenMousemove_triggersCallback', () => {
    const dragCb = vi.fn();
    adapter.on('drag', dragCb);

    dispatchMouseDown(100, 100);
    dispatchMouseMove(120, 110);

    expect(dragCb).toHaveBeenCalledTimes(1);
    // deltaX = 120 - 100 = 20, deltaY = 110 - 100 = 10
    expect(dragCb).toHaveBeenCalledWith(
      expect.objectContaining({ deltaX: 20, deltaY: 10 })
    );
  });

  it('test_onDrag_multipleMoves_accumulateDelta', () => {
    const dragCb = vi.fn();
    adapter.on('drag', dragCb);

    dispatchMouseDown(100, 100);
    dispatchMouseMove(110, 105); // deltaX=10, deltaY=5
    dispatchMouseMove(125, 115); // deltaX=15, deltaY=10

    expect(dragCb).toHaveBeenCalledTimes(2);
    expect(dragCb).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ deltaX: 10, deltaY: 5 })
    );
    expect(dragCb).toHaveBeenNthCalledWith(2,
      expect.objectContaining({ deltaX: 15, deltaY: 10 })
    );
  });

  // ─── dragEnd ───

  it('test_onDragEnd_mouseup_triggersCallbackWithTotalDelta', () => {
    const dragEndCb = vi.fn();
    adapter.on('dragEnd', dragEndCb);

    dispatchMouseDown(100, 100);
    dispatchMouseMove(130, 120);
    dispatchMouseUp(130, 120);

    expect(dragEndCb).toHaveBeenCalledTimes(1);
    // totalDeltaX = 130 - 100 = 30, totalDeltaY = 120 - 100 = 20
    expect(dragEndCb).toHaveBeenCalledWith({ totalDeltaX: 30, totalDeltaY: 20 });
  });

  it('test_onDragEnd_noMove_totalDeltaIsZero', () => {
    const dragEndCb = vi.fn();
    adapter.on('dragEnd', dragEndCb);

    dispatchMouseDown(100, 100);
    dispatchMouseUp(100, 100);

    expect(dragEndCb).toHaveBeenCalledWith({ totalDeltaX: 0, totalDeltaY: 0 });
  });

  // ─── tap ───

  it('test_onTap_clickWithoutDrag_triggersCallback', () => {
    const tapCb = vi.fn();
    adapter.on('tap', tapCb);

    // 模拟点击：mousedown -> mouseup -> click（无拖拽）
    dispatchMouseDown(100, 200);
    dispatchMouseUp(100, 200);
    dispatchClick(100, 200);

    expect(tapCb).toHaveBeenCalledTimes(1);
    expect(tapCb).toHaveBeenCalledWith({ x: 100, y: 200 });
  });

  it('test_onTap_clickAfterDrag_doesNotTrigger', () => {
    const tapCb = vi.fn();
    adapter.on('tap', tapCb);

    // 拖拽超过阈值（dragThreshold = 5）
    dispatchMouseDown(100, 100);
    dispatchMouseMove(200, 200); // 移动 100px，远超阈值
    dispatchMouseUp(200, 200);
    dispatchClick(200, 200);

    // 拖拽后 click 不应触发 tap
    expect(tapCb).not.toHaveBeenCalled();
  });

  // ─── off ───

  it('test_off_removesCallback', () => {
    const cb = vi.fn();
    adapter.on('scroll', cb);
    adapter.off('scroll', cb);

    dispatchWheel(100, 0, false);

    expect(cb).not.toHaveBeenCalled();
  });

  it('test_off_returnsUnsubscribeFunction', () => {
    const cb = vi.fn();
    const unsubscribe = adapter.on('scroll', cb);

    dispatchWheel(100, 0, false);
    expect(cb).toHaveBeenCalledTimes(1);

    unsubscribe();

    dispatchWheel(200, 0, false);
    expect(cb).toHaveBeenCalledTimes(1); // 不再被调用
  });

  it('test_off_onlyRemovesTargetCallback', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    adapter.on('scroll', cb1);
    adapter.on('scroll', cb2);

    adapter.off('scroll', cb1);

    dispatchWheel(100, 0, false);

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  // ─── emit ───

  it('test_emit_callsAllRegisteredCallbacks', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();

    adapter.on('scroll', cb1);
    adapter.on('scroll', cb2);
    adapter.on('scroll', cb3);

    adapter.emit('scroll', { deltaY: 50, deltaX: 0, ctrlKey: false });

    expect(cb1).toHaveBeenCalledWith({ deltaY: 50, deltaX: 0, ctrlKey: false });
    expect(cb2).toHaveBeenCalledWith({ deltaY: 50, deltaX: 0, ctrlKey: false });
    expect(cb3).toHaveBeenCalledWith({ deltaY: 50, deltaX: 0, ctrlKey: false });
  });

  it('test_emit_unknownEvent_doesNothing', () => {
    const cb = vi.fn();
    adapter.on('scroll', cb);

    // emit 一个没有注册回调的事件
    adapter.emit('unknownEvent', { some: 'data' });

    expect(cb).not.toHaveBeenCalled();
  });

  it('test_emit_callbackError_doesNotBlockOthers', () => {
    const errorCb = vi.fn(() => { throw new Error('test error'); });
    const normalCb = vi.fn();

    // 抑制 console.error 输出
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    adapter.on('scroll', errorCb);
    adapter.on('scroll', normalCb);

    adapter.emit('scroll', { deltaY: 10, deltaX: 0, ctrlKey: false });

    expect(errorCb).toHaveBeenCalledTimes(1);
    expect(normalCb).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
  });

  // ─── destroy ───

  it('test_destroy_removesAllCallbacks', () => {
    const scrollCb = vi.fn();
    const dragStartCb = vi.fn();

    adapter.on('scroll', scrollCb);
    adapter.on('dragStart', dragStartCb);

    adapter.destroy();

    dispatchWheel(100, 0, false);
    dispatchMouseDown(100, 200);

    expect(scrollCb).not.toHaveBeenCalled();
    expect(dragStartCb).not.toHaveBeenCalled();
  });
});
