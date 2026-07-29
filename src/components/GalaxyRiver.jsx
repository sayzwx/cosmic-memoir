import { useEffect, useRef } from 'react'

const STAR_COUNT = 720
const ARM_COUNT = 4
const FRAME_INTERVAL_MS = 1000 / 30

function createStars() {
  let seed = 7319
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  return Array.from({ length: STAR_COUNT }, (_, index) => {
    const core = Math.pow(random(), 2.35)
    return {
      arm: index % ARM_COUNT,
      radius: 0.025 + core * 0.72,
      jitter: (random() - 0.5) * (0.018 + core * 0.16),
      phase: random() * Math.PI * 2,
      size: 0.28 + Math.pow(random(), 5) * 2.1,
      brightness: 0.2 + random() * 0.8,
      warmth: random(),
      drift: 0.65 + random() * 0.7
    }
  })
}

const STARS = createStars()

export function GalaxyRiver() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d', { alpha: true })
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let width = 0
    let height = 0
    let pixelRatio = 1
    let lastRenderTime = -Infinity

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvas.width = Math.round(width * pixelRatio)
      canvas.height = Math.round(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const draw = (milliseconds = 0) => {
      if (!reducedMotion && milliseconds - lastRenderTime < FRAME_INTERVAL_MS) {
        frame = requestAnimationFrame(draw)
        return
      }
      lastRenderTime = milliseconds
      const time = milliseconds * 0.001
      const centerX = width * 0.5
      const centerY = height * 0.5
      const majorRadius = width * 0.46
      const minorRadius = height * 0.33
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'screen'

      const clouds = [
        { x: -0.31, y: 0.1, radius: 0.55, color: '56, 117, 255', alpha: 0.18 },
        { x: 0.29, y: -0.16, radius: 0.48, color: '157, 79, 242', alpha: 0.17 },
        { x: 0.04, y: 0.23, radius: 0.36, color: '48, 199, 255', alpha: 0.13 }
      ]
      for (const cloud of clouds) {
        const gradient = context.createRadialGradient(
          centerX + cloud.x * majorRadius,
          centerY + cloud.y * minorRadius,
          0,
          centerX + cloud.x * majorRadius,
          centerY + cloud.y * minorRadius,
          majorRadius * cloud.radius
        )
        gradient.addColorStop(0, `rgba(${cloud.color}, ${cloud.alpha})`)
        gradient.addColorStop(0.4, `rgba(${cloud.color}, ${cloud.alpha * 0.34})`)
        gradient.addColorStop(1, `rgba(${cloud.color}, 0)`)
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      }

      // The wide dust disk deliberately covers the black-hole focal point.
      context.save()
      context.translate(centerX, centerY)
      context.rotate(-0.12 + Math.sin(time * 0.025) * 0.035)
      context.scale(1, 0.56)
      const disk = context.createRadialGradient(0, 0, 0, 0, 0, majorRadius)
      disk.addColorStop(0, 'rgba(255, 244, 216, 0.82)')
      disk.addColorStop(0.045, 'rgba(255, 206, 139, 0.58)')
      disk.addColorStop(0.14, 'rgba(150, 194, 255, 0.31)')
      disk.addColorStop(0.42, 'rgba(73, 103, 229, 0.14)')
      disk.addColorStop(0.8, 'rgba(47, 69, 178, 0.035)')
      disk.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = disk
      context.beginPath()
      context.arc(0, 0, majorRadius, 0, Math.PI * 2)
      context.fill()
      context.restore()

      context.save()
      context.translate(centerX, centerY)
      context.rotate(-0.12)
      context.scale(1, 0.56)
      context.filter = 'blur(4px)'
      for (let arm = 0; arm < ARM_COUNT; arm += 1) {
        context.beginPath()
        for (let step = 0; step <= 48; step += 1) {
          const radius = (step / 48) * majorRadius * 0.91
          const angle = arm * (Math.PI * 2 / ARM_COUNT) + radius * 0.011 + time * 0.018
          const x = Math.cos(angle) * radius
          const y = Math.sin(angle) * radius
          if (step === 0) context.moveTo(x, y)
          else context.lineTo(x, y)
        }
        context.strokeStyle = arm % 2 ? 'rgba(116, 166, 255, 0.18)' : 'rgba(255, 174, 108, 0.14)'
        context.lineWidth = 15
        context.stroke()
      }
      context.restore()

      for (const star of STARS) {
        const radius = star.radius * majorRadius
        const angle = star.arm * (Math.PI * 2 / ARM_COUNT) + radius * 0.011 + star.phase * 0.11 + time * 0.016 * star.drift
        const tangentialJitter = star.jitter * majorRadius
        const x = centerX + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * tangentialJitter
        const y = centerY + (Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * tangentialJitter) * 0.56
        const edgeFade = Math.pow(1 - star.radius, 0.4)
        const alpha = (0.13 + star.brightness * 0.72) * edgeFade
        const size = star.size * (1.28 - star.radius * 0.42)
        const warm = star.warmth > 0.78
        context.fillStyle = warm
          ? `rgba(255, ${190 + Math.round(star.warmth * 45)}, 151, ${alpha})`
          : `rgba(${164 + Math.round(star.brightness * 82)}, ${202 + Math.round(star.brightness * 43)}, 255, ${alpha})`
        context.beginPath()
        context.arc(x, y, size, 0, Math.PI * 2)
        context.fill()

        if (size > 1.42 && star.brightness > 0.74) {
          context.strokeStyle = `rgba(227, 244, 255, ${alpha * 0.46})`
          context.lineWidth = 0.5
          context.beginPath()
          context.moveTo(x - size * 4.1, y)
          context.lineTo(x + size * 4.1, y)
          context.stroke()
        }
      }

      const nucleus = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, majorRadius * 0.18)
      nucleus.addColorStop(0, 'rgba(255, 255, 244, 0.98)')
      nucleus.addColorStop(0.08, 'rgba(255, 220, 165, 0.85)')
      nucleus.addColorStop(0.32, 'rgba(166, 201, 255, 0.26)')
      nucleus.addColorStop(1, 'rgba(98, 127, 255, 0)')
      context.fillStyle = nucleus
      context.fillRect(centerX - majorRadius * 0.2, centerY - majorRadius * 0.2, majorRadius * 0.4, majorRadius * 0.4)

      context.globalCompositeOperation = 'source-over'
      if (!reducedMotion) frame = requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    draw()

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} className="galaxy-river-canvas" aria-hidden="true" />
}
