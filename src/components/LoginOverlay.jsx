import { useState, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import { useAuth } from '../hooks/useAuth'
import { sharedState } from '../store/sharedState'

export function LoginOverlay({ cardRef }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hint, setHint] = useState('校准引力波频率以穿越奇点')
  const [hintClass, setHintClass] = useState('')
  const [isValid, setIsValid] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockRemaining, setLockRemaining] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const { authenticate, checkLock } = useAuth()
  const lockTimerRef = useRef(null)
  const cardInnerRef = useRef(null)

  // Initial lock state
  useEffect(() => {
    const lock = checkLock()
    if (lock.locked) {
      setIsLocked(true)
      setLockRemaining(lock.remaining)
      setHint(`时空已锁定，请等待 ${lock.remaining}s`)
      setHintClass('error')
    }
  }, [checkLock])

  // Lock countdown
  useEffect(() => {
    if (!isLocked) return

    lockTimerRef.current = setInterval(() => {
      const lock = checkLock()
      if (lock.locked) {
        setLockRemaining(lock.remaining)
        setHint(`时空已锁定，请等待 ${lock.remaining}s`)
      } else {
        setIsLocked(false)
        setHint('校准引力波频率以穿越奇点')
        setHintClass('')
        clearInterval(lockTimerRef.current)
      }
    }, 1000)

    return () => clearInterval(lockTimerRef.current)
  }, [isLocked, checkLock])

  // Validate whenever inputs change
  useEffect(() => {
    const valid =
      username.trim().length > 0 && password.trim().length > 0 && !isLocked
    setIsValid(valid)
    sharedState.isValid = valid

    if (valid) {
      setHint('频率锁定就绪')
      setHintClass('ready')
    } else if (!isLocked) {
      setHint('校准引力波频率以穿越奇点')
      setHintClass('')
    }
  }, [username, password, isLocked])

  // Project a DOM element's center into world space and store as the focus point
  const projectElementToWorld = useCallback((el) => {
    if (!el || !sharedState.camera) return

    const rect = el.getBoundingClientRect()
    const cx = ((rect.left + rect.width / 2) / window.innerWidth) * 2 - 1
    const cy = -(((rect.top + rect.height / 2) / window.innerHeight) * 2 - 1)

    const vector = new THREE.Vector3(cx, cy, 0.5)
    vector.unproject(sharedState.camera)

    const dir = vector.sub(sharedState.camera.position).normalize()
    const distance = 40
    const point = sharedState.camera.position.clone().add(dir.multiplyScalar(distance))

    sharedState.focusPoint.copy(point)
    sharedState.focusStrength = 1.0
  }, [])

  const triggerPulse = useCallback((element) => {
    sharedState.pulseRadius = 0
    sharedState.pulseStrength = 1.0
    sharedState.pulseOrigin.set(0, 0, 0)
    projectElementToWorld(element)
  }, [projectElementToWorld])

  const handleFocus = useCallback((e) => {
    triggerPulse(e.target)
  }, [triggerPulse])

  const handleBlur = useCallback(() => {
    sharedState.focusStrength = 0
  }, [])

  const handlePasswordKeyDown = useCallback(() => {
    // Emit a photon on each keystroke
    const photon = {
      active: true,
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 2 + 5,
        (Math.random() - 0.5) * 4
      ),
      angle: Math.random() * Math.PI * 2,
      radius: 18 + Math.random() * 8,
      speed: 0.6 + Math.random() * 0.6,
      color: new THREE.Color(0, 0.94, 1.0)
    }

    sharedState.photons.push(photon)
    if (sharedState.photons.length > sharedState.maxPhotons) {
      sharedState.photons.shift()
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!isValid || isLocked || isTransitioning) return

    setHint('正在校验时空坐标...')
    setHintClass('')

    await new Promise((r) => setTimeout(r, 450))

    const result = await authenticate(username.trim(), password.trim())

    if (result.success) {
      setHint('验证通过。正在生成爱因斯坦-罗森桥...')
      setHintClass('success')
      setIsTransitioning(true)

      sharedState.isTransitioning = true
      sharedState.transitionProgress = 0

      setTimeout(() => {
        window.location.href = './universe.html'
      }, 2600)
    } else {
      setHint(`引力参数不匹配。还剩 ${result.remaining} 次尝试。`)
      setHintClass('error')

      // Shake the inner card (outer card transform is driven by CameraRig)
      if (cardInnerRef.current) {
        cardInnerRef.current.classList.remove('shake')
        void cardInnerRef.current.offsetWidth
        cardInnerRef.current.classList.add('shake')
        setTimeout(() => {
          if (cardInnerRef.current) cardInnerRef.current.classList.remove('shake')
        }, 450)
      }

      setPassword('')

      if (result.locked) {
        setIsLocked(true)
        setLockRemaining(result.remaining)
        setHint(`时空已锁定，请等待 ${result.remaining}s`)
      }
    }
  }, [
    username,
    password,
    isValid,
    isLocked,
    isTransitioning,
    authenticate
  ])

  return (
    <div className="login-overlay">
      <div className="login-card" ref={cardRef}>
        <div className="login-card-inner" ref={cardInnerRef}>
          <div className="login-header">
            <h1 className="login-title">奇点验证</h1>
            <p className="login-subtitle">Singularity Verification</p>
          </div>

          <div className="input-group">
            <input
              type="text"
              className="input-field"
              placeholder="观测者 ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoComplete="off"
              spellCheck={false}
              disabled={isLocked || isTransitioning}
            />
            <div className="input-glow" />
          </div>

          <div className="input-group">
            <input
              type="password"
              className="input-field"
              placeholder="引力密钥"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handlePasswordKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              autoComplete="off"
              spellCheck={false}
              disabled={isLocked || isTransitioning}
            />
            <div className="input-glow" />
          </div>

          <button
            className={`login-btn ${isValid ? 'active' : ''} ${
              isLocked ? 'locked' : ''
            } ${isTransitioning ? 'warping' : ''}`}
            onClick={handleSubmit}
            disabled={!isValid || isLocked || isTransitioning}
          >
            <span className="btn-text">
              {isLocked
                ? `时空锁定 ${lockRemaining}s`
                : isTransitioning
                ? '穿越中...'
                : isValid
                ? '穿越事件视界'
                : '事件视界尚未形成'}
            </span>
            <span className="btn-pulse" />
          </button>

          <p className={`login-hint ${hintClass}`}>{hint}</p>
        </div>
      </div>
    </div>
  )
}
