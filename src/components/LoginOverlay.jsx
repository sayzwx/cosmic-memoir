import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { sharedState } from '../store/sharedState'
import config from '../config.json'

const AGGREGATION_PARTICLES = Array.from({ length: 56 }, (_, index) => {
  const angle = (index / 56) * Math.PI * 2 + (index % 5) * 0.19
  const radius = 180 + (index % 9) * 24
  return {
    id: index,
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius * 0.62,
    delay: (index % 14) * 0.045,
    size: 1 + (index % 4) * 0.65,
    warm: index % 5 === 0
  }
})

export function LoginOverlay({ cardRef, isAwakened, onAwaken }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [hint, setHint] = useState(config.login.hint.idle)
  const [hintClass, setHintClass] = useState('')
  const [isValid, setIsValid] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockRemaining, setLockRemaining] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [floatingChars, setFloatingChars] = useState([])
  const [activeField, setActiveField] = useState(null)

  const { authenticate, checkLock } = useAuth()
  const lockTimerRef = useRef(null)
  const identityInputRef = useRef(null)
  const keyInputRef = useRef(null)
  const charIdCounter = useRef(0)

  useEffect(() => {
    const lock = checkLock()
    if (lock.locked) {
      setIsLocked(true)
      setLockRemaining(lock.remaining)
      setHint(config.login.hint.locked.replace('{}', lock.remaining))
      setHintClass('error')
    }
  }, [checkLock])

  useEffect(() => {
    if (!isAwakened || isLocked) return undefined
    const focusTimer = setTimeout(() => identityInputRef.current?.focus(), 1150)
    return () => clearTimeout(focusTimer)
  }, [isAwakened, isLocked])

  useEffect(() => {
    if (!isLocked) return
    lockTimerRef.current = setInterval(() => {
      const lock = checkLock()
      if (lock.locked) {
        setLockRemaining(lock.remaining)
        setHint(config.login.hint.locked.replace('{}', lock.remaining))
      } else {
        setIsLocked(false)
        setHint(config.login.hint.idle)
        setHintClass('')
        clearInterval(lockTimerRef.current)
      }
    }, 1000)
    return () => clearInterval(lockTimerRef.current)
  }, [isLocked, checkLock])

  const updateInputEnergy = useCallback((u, p) => {
    const energy = Math.min(1, (u.length / 4 + p.length / 4) * 0.5)
    sharedState.inputEnergy = energy
  }, [])

  useEffect(() => {
    const valid = username.trim().length > 0 && password.trim().length > 0 && !isLocked
    setIsValid(valid)
    sharedState.isValid = valid
    if (valid) {
      setHint(config.login.hint.ready)
      setHintClass('ready')
    } else if (!isLocked) {
      setHint(username.length > 0 || password.length > 0 ? config.login.hint.typing : config.login.hint.idle)
      setHintClass('')
    }
  }, [username, password, isLocked])

  const handleIdentityChange = useCallback((e) => {
    const newValue = e.target.value
    if (newValue.length > username.length) {
      const newChar = newValue.slice(-1)
      const id = ++charIdCounter.current
      setFloatingChars(prev => [...prev, { id, char: newChar, field: 'identity' }])
      setTimeout(() => {
        setFloatingChars(prev => prev.filter(c => c.id !== id))
      }, 1400)
    }
    setUsername(newValue)
    updateInputEnergy(newValue, password)
  }, [username, password, updateInputEnergy])

  const handleKeyChange = useCallback((e) => {
    const newValue = e.target.value
    setPassword(newValue)
    updateInputEnergy(username, newValue)
  }, [username, updateInputEnergy])

  const handleIdentityFocus = useCallback(() => {
    onAwaken()
    setActiveField('identity')
  }, [onAwaken])

  const handleKeyFocus = useCallback(() => {
    onAwaken()
    setActiveField('key')
  }, [onAwaken])

  const handleBlur = useCallback(() => {
    setActiveField(null)
    sharedState.focusStrength = 0
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!isValid || isLocked || isTransitioning) return

    setHint(config.login.hint.verifying)
    setHintClass('')

    await new Promise(r => setTimeout(r, 450))
    const result = await authenticate(username.trim(), password.trim())

    if (result.success) {
      setHint(config.login.hint.success)
      setHintClass('success')
      setIsTransitioning(true)
      sharedState.isTransitioning = true
      sharedState.transitionProgress = 0
      setTimeout(() => {
        window.location.href = './universe.html'
      }, 4500)
    } else {
      setHint(`${config.login.hint.error} ${result.remaining} attempts remaining.`)
      setHintClass('error')
      setPassword('')
      updateInputEnergy(username, '')
      if (result.locked) {
        setIsLocked(true)
        setLockRemaining(result.remaining)
        setHint(config.login.hint.locked.replace('{}', result.remaining))
      }
    }
  }, [username, password, isValid, isLocked, isTransitioning, authenticate, updateInputEnergy])

  const passwordDots = Array.from({ length: Math.min(password.length, 12) })

  return (
    <div className="login-overlay">
      <div className="slogan-section">
        <div className="slogan-kicker">COSMIC MEMOIR / OBSERVATION LOG</div>
        <h1 className="slogan-title">{config.slogan.title}</h1>
        <p className="slogan-subtitle">{config.slogan.subtitle}</p>
      </div>
      {isAwakened && !isTransitioning && <form
        className="login-card awakened"
        ref={cardRef}
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <div className="aggregation-field" aria-hidden="true">
          {AGGREGATION_PARTICLES.map((particle) => (
            <i
              key={particle.id}
              className={`aggregation-particle ${particle.warm ? 'warm' : ''}`}
              style={{
                '--from-x': `${particle.x}px`,
                '--from-y': `${particle.y}px`,
                '--delay': `${particle.delay}s`,
                '--particle-size': `${particle.size}px`
              }}
            />
          ))}
        </div>

        <div className="galaxy-form-body" aria-label="Memory input constellation">
          <div className="galaxy-axis" />
          <label className={`galaxy-field ${activeField === 'identity' ? 'active' : ''}`}>
            <span className="field-star blue" />
            <span className="field-label">{config.login.identityPlaceholder}</span>
            <input
              ref={identityInputRef}
              type="text"
              value={username}
              onChange={handleIdentityChange}
              onFocus={handleIdentityFocus}
              onBlur={handleBlur}
              autoComplete="username"
              spellCheck={false}
              disabled={isLocked || isTransitioning}
            />
            <span className="field-dust" />
            <div className="floating-chars-container">
              {floatingChars.filter(c => c.field === 'identity').map(c => (
                <span key={c.id} className={`floating-char ${c.field}-char`}>{c.char}</span>
              ))}
            </div>
          </label>

          <label className={`galaxy-field ${activeField === 'key' ? 'active' : ''}`}>
            <span className="field-star gold" />
            <span className="field-label">{config.login.keyPlaceholder}</span>
            <input
              ref={keyInputRef}
              type="password"
              value={password}
              onChange={handleKeyChange}
              onFocus={handleKeyFocus}
              onBlur={handleBlur}
              autoComplete="current-password"
              spellCheck={false}
              disabled={isLocked || isTransitioning}
            />
            <span className="field-dust warm" />
            <div className="golden-dots-container" aria-hidden="true">
              {passwordDots.map((_, i) => (
                <span key={i} className="golden-dot" style={{ '--orbit': `${i * 30}deg`, animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
          </label>

          <div className="submit-zone">
            <button
              type="submit"
              className={`submit-btn ${isValid && !isLocked ? 'visible' : ''} ${
                isTransitioning ? 'warping' : ''
              } ${isLocked ? 'locked' : ''}`}
              disabled={!isValid || isLocked || isTransitioning}
            >
              <span className="btn-text">
                {isLocked
                  ? `Locked ${lockRemaining}s`
                  : isTransitioning
                  ? config.login.button.transitioning
                  : isValid
                  ? config.login.button.ready
                  : config.login.button.idle}
              </span>
            </button>
          </div>

          <p className={`login-hint ${hintClass}`}>{hint}</p>
        </div>
      </form>}
    </div>
  )
}
