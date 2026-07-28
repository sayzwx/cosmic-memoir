import { useCallback } from 'react'

const CREDENTIALS = {
  username: 'mjsx',
  passwordHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
}

const CONFIG = {
  maxAttempts: 5,
  lockDuration: 60000,
  sessionTimeout: 3600000
}

const TOKEN_KEY = 'cm_token'
const LOGIN_TIME_KEY = 'cm_loginTime'
const FAILED_KEY = 'cm_failedAttempts'
const LOCK_KEY = 'cm_lockUntil'

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function generateToken() {
  const payload = Date.now().toString() + Math.random().toString() + navigator.userAgent
  return await sha256(payload)
}

function recordFailure() {
  const failedAttempts = parseInt(localStorage.getItem(FAILED_KEY) || '0', 10) + 1
  localStorage.setItem(FAILED_KEY, failedAttempts.toString())

  if (failedAttempts >= CONFIG.maxAttempts) {
    const lockUntil = Date.now() + CONFIG.lockDuration
    localStorage.setItem(LOCK_KEY, lockUntil.toString())
    return {
      success: false,
      locked: true,
      remaining: Math.ceil(CONFIG.lockDuration / 1000)
    }
  }

  return {
    success: false,
    locked: false,
    remaining: CONFIG.maxAttempts - failedAttempts
  }
}

export function useAuth() {
  const checkLock = useCallback(() => {
    const lockUntil = parseInt(localStorage.getItem(LOCK_KEY) || '0', 10)
    const now = Date.now()
    if (now < lockUntil) {
      return {
        locked: true,
        remaining: Math.ceil((lockUntil - now) / 1000)
      }
    }
    return { locked: false, remaining: 0 }
  }, [])

  const authenticate = useCallback(async (username, password) => {
    const lock = checkLock()
    if (lock.locked) {
      return { success: false, locked: true, remaining: lock.remaining }
    }

    if (username !== CREDENTIALS.username) {
      return recordFailure()
    }

    const inputHash = await sha256(password)
    if (inputHash !== CREDENTIALS.passwordHash) {
      return recordFailure()
    }

    const token = await generateToken()
    const loginTime = Date.now()
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(LOGIN_TIME_KEY, loginTime.toString())
    localStorage.removeItem(FAILED_KEY)
    localStorage.removeItem(LOCK_KEY)

    return { success: true }
  }, [checkLock])

  return { authenticate, checkLock }
}
