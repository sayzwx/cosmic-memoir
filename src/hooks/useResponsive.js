import { useState, useEffect } from 'react'
import { sharedState } from '../store/sharedState'

export function useResponsive() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' &&
      (window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent))
  )

  const [particleCount, setParticleCount] = useState(isMobile ? 15000 : 50000)

  useEffect(() => {
    const check = () => {
      const mobile =
        window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      setIsMobile(mobile)
      setParticleCount(mobile ? 15000 : 50000)
    }

    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Gyroscope support on mobile devices
  useEffect(() => {
    if (!isMobile) return

    const handleOrientation = (e) => {
      if (e.gamma == null || e.beta == null) return
      const x = Math.max(-1, Math.min(1, e.gamma / 45))
      const y = Math.max(-1, Math.min(1, -(e.beta - 45) / 45))
      sharedState.mouseParallax.set(x, y)
    }

    const requestPermission = async () => {
      try {
        if (
          typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function'
        ) {
          const response = await DeviceOrientationEvent.requestPermission()
          if (response === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation)
          }
        } else {
          window.addEventListener('deviceorientation', handleOrientation)
        }
      } catch (e) {
        // ignore
      } finally {
        document.removeEventListener('touchstart', requestPermission)
      }
    }

    document.addEventListener('touchstart', requestPermission)
    return () => {
      document.removeEventListener('touchstart', requestPermission)
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [isMobile])

  return { isMobile, particleCount }
}
