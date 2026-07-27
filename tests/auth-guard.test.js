/**
 * auth-guard.js 测试
 *
 * auth-guard 是一个 IIFE（立即执行函数），在导入时即执行。
 * 需要通过 vi.resetModules() + dynamic import 来隔离每个测试用例，
 * 确保每次导入时 IIFE 都重新执行。
 *
 * 测试覆盖：
 * - 有效 token + 未过期 -> 认证通过，不跳转
 * - 无 token -> 跳转到 login.html
 * - 过期 token（loginTime 超过 1h）-> 跳转 + token 被清除
 * - token 被正确从 sessionStorage 清除
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const TOKEN_KEY = 'cm_token';
const LOGIN_TIME_KEY = 'cm_loginTime';
const SESSION_TIMEOUT = 3600000; // 1 小时

describe('auth-guard', () => {
  let replaceMock;

  beforeEach(() => {
    // 清空 sessionStorage
    sessionStorage.clear();

    // Mock window.location —— jsdom 中 location 不可直接赋值，用 defineProperty 覆盖
    replaceMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        pathname: '/universe.html',
        href: 'http://localhost/universe.html',
        replace: replaceMock
      }
    });

    // 清除上次导入留下的全局状态
    delete window.__cosmicMemoirAuth;

    // 重置模块缓存，确保 IIFE 重新执行
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('test_validToken_notExpired_authenticated', async () => {
    // 设置有效 token 和当前时间
    sessionStorage.setItem(TOKEN_KEY, 'valid_token_123');
    sessionStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());

    await import('../js/auth-guard.js');

    expect(window.__cosmicMemoirAuth.authenticated).toBe(true);
    expect(window.__cosmicMemoirAuth.token).toBe('valid_token_123');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('test_noToken_redirectToLogin', async () => {
    // 不设置任何 token
    await import('../js/auth-guard.js');

    expect(window.__cosmicMemoirAuth.authenticated).toBe(false);
    expect(window.__cosmicMemoirAuth.token).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith('./login.html');
  });

  it('test_expiredToken_redirectAndClearToken', async () => {
    // 设置过期 token（loginTime 在 1 小时以前）
    const expiredTime = Date.now() - (SESSION_TIMEOUT + 60000); // 超时 1 分钟
    sessionStorage.setItem(TOKEN_KEY, 'expired_token');
    sessionStorage.setItem(LOGIN_TIME_KEY, expiredTime.toString());

    await import('../js/auth-guard.js');

    expect(window.__cosmicMemoirAuth.authenticated).toBe(false);
    expect(replaceMock).toHaveBeenCalledWith('./login.html');
  });

  it('test_expiredToken_clearedFromSessionStorage', async () => {
    // 设置过期 token
    const expiredTime = Date.now() - (SESSION_TIMEOUT + 60000);
    sessionStorage.setItem(TOKEN_KEY, 'expired_token');
    sessionStorage.setItem(LOGIN_TIME_KEY, expiredTime.toString());

    await import('../js/auth-guard.js');

    // 验证 token 和 loginTime 都被从 sessionStorage 中清除
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(LOGIN_TIME_KEY)).toBeNull();
  });

  it('test_noToken_setsRedirectPath', async () => {
    // 未认证时应记录当前页面路径到 cm_redirect
    await import('../js/auth-guard.js');

    expect(sessionStorage.getItem('cm_redirect')).toBe('/universe.html');
  });

  it('test_validToken_redirectNotSet', async () => {
    // 认证通过时不应设置 cm_redirect
    sessionStorage.setItem(TOKEN_KEY, 'valid_token');
    sessionStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());

    await import('../js/auth-guard.js');

    expect(sessionStorage.getItem('cm_redirect')).toBeNull();
  });

  it('test_emptyToken_redirectToLogin', async () => {
    // token 为空字符串
    sessionStorage.setItem(TOKEN_KEY, '');
    sessionStorage.setItem(LOGIN_TIME_KEY, Date.now().toString());

    await import('../js/auth-guard.js');

    // 空字符串在 if(token) 中为 falsy，因此不认证
    expect(window.__cosmicMemoirAuth.authenticated).toBe(false);
    expect(replaceMock).toHaveBeenCalledWith('./login.html');
  });

  it('test_tokenWithoutLoginTime_redirectToLogin', async () => {
    // 有 token 但没有 loginTime
    sessionStorage.setItem(TOKEN_KEY, 'some_token');
    // 不设置 LOGIN_TIME_KEY

    await import('../js/auth-guard.js');

    // loginTime 为 0，parseInt('0') = 0，if(loginTime) 为 false
    expect(window.__cosmicMemoirAuth.authenticated).toBe(false);
    expect(replaceMock).toHaveBeenCalledWith('./login.html');
  });

  it('test_justBeforeTimeout_authenticated', async () => {
    // 刚好在超时前 1 秒
    const almostExpired = Date.now() - (SESSION_TIMEOUT - 1000);
    sessionStorage.setItem(TOKEN_KEY, 'almost_expired_token');
    sessionStorage.setItem(LOGIN_TIME_KEY, almostExpired.toString());

    await import('../js/auth-guard.js');

    expect(window.__cosmicMemoirAuth.authenticated).toBe(true);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
