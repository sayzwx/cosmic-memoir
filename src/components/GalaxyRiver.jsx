import { useEffect, useRef } from 'react'

const STAR_COUNT = 760

function createStars() {
  let seed = 7319
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }

  return Array.from({ length: STAR_COUNT }, () => {
    const depth = random()
    return {
      x: random(),
      spread: (random() - 0.5) * (0.22 + depth * 1.5),
      depth,
      size: 0.25 + Math.pow(random(), 5) * 2.15,
      speed: 0.003 + random() * 0.009,
      phase: random() * Math.PI * 2,
      warmth: random()
    }
  })
}

const STARS = createStars()

export function GalaxyRiver() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let width = 0
    let height = 0
    let pixelRatio = 1

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
      const time = milliseconds * 0.001
      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = 'screen'

      const haze = context.createRadialGradient(width * 0.5, height * 0.51, 0, width * 0.5, height * 0.51, width * 0.48)
      haze.addColorStop(0, 'rgba(255, 226, 178, 0.34)')
      haze.addColorStop(0.08, 'rgba(168, 203, 255, 0.28)')
      haze.addColorStop(0.28, 'rgba(76, 104, 220, 0.16)')
      haze.addColorStop(0.62, 'rgba(29, 58, 138, 0.055)')
      haze.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = haze
      context.fillRect(0, 0, width, height)

      const coreY = height * 0.5
      const core = context.createLinearGradient(0, coreY, width, coreY)
      core.addColorStop(0, 'rgba(71, 142, 255, 0)')
      core.addColorStop(0.21, 'rgba(83, 153, 255, 0.18)')
      core.addColorStop(0.48, 'rgba(235, 247, 255, 0.54)')
      core.addColorStop(0.53, 'rgba(255, 210, 143, 0.5)')
      core.addColorStop(0.8, 'rgba(100, 115, 241, 0.15)')
      core.addColorStop(1, 'rgba(74, 123, 255, 0)')
      context.save()
      context.filter = 'blur(5px)'
      context.fillStyle = core
      context.fillRect(0, coreY - 11, width, 22)
      context.restore()

      for (const star of STARS) {
        const progress = (star.x + time * star.speed) % 1
        const wave = Math.sin(progress * Math.PI * 2 + time * 0.055) * height * 0.075
        const curl = Math.sin(progress * Math.PI * 4 + star.phase) * height * 0.025 * star.depth
        const x = progress * width
        const y = coreY + wave + curl + star.spread * height * 0.48
        const edgeFade = Math.sin(progress * Math.PI)
        const density = Math.max(0, 1 - Math.abs(y - coreY) / (height * 0.58))
        const alpha = (0.12 + (1 - star.depth) * 0.68) * edgeFade * density
        if (alpha <= 0.015) continue

        const radius = star.size * (1.15 - star.depth * 0.45)
        const warm = star.warmth > 0.79
        context.fillStyle = warm
          ? `rgba(255, ${198 + Math.round(star.warmth * 40)}, 164, ${alpha})`
          : `rgba(${170 + Math.round((1 - star.depth) * 70)}, ${205 + Math.round((1 - star.depth) * 40)}, 255, ${alpha})`
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fill()

        if (radius > 1.25) {
          context.strokeStyle = `rgba(220, 240, 255, ${alpha * 0.42})`
          context.lineWidth = 0.55
          context.beginPath()
          context.moveTo(x - radius * 3.2, y)
          context.lineTo(x + radius * 3.2, y)
          context.stroke()
        }
      }

      context.globalCompositeOperation = 'source-over'
      if (!reducedMotion) frame = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(frame)
    }
  }, [])

  return <canvas ref={canvasRef} className="galaxy-river-canvas" aria-hidden="true" />
}
