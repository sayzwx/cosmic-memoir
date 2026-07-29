import { useEffect, useRef } from 'react'

const STAR_COUNT = 1100

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

      const coreX = width * (0.5 + Math.sin(time * 0.045) * 0.018)
      const coreY = height * 0.5

      // Nebula clouds sit behind the arms and give the river a volumetric core.
      const clouds = [
        { x: coreX - width * 0.19, y: coreY + height * 0.04, radius: width * 0.3, color: '74, 126, 255' },
        { x: coreX + width * 0.22, y: coreY - height * 0.08, radius: width * 0.26, color: '174, 93, 255' },
        { x: coreX + width * 0.03, y: coreY + height * 0.1, radius: width * 0.19, color: '76, 196, 255' }
      ]
      for (const cloud of clouds) {
        const gradient = context.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius)
        gradient.addColorStop(0, `rgba(${cloud.color}, 0.18)`)
        gradient.addColorStop(0.32, `rgba(${cloud.color}, 0.085)`)
        gradient.addColorStop(1, `rgba(${cloud.color}, 0)`)
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)
      }

      const haze = context.createRadialGradient(coreX, coreY, 0, coreX, coreY, width * 0.48)
      haze.addColorStop(0, 'rgba(255, 243, 213, 0.68)')
      haze.addColorStop(0.035, 'rgba(255, 218, 158, 0.52)')
      haze.addColorStop(0.12, 'rgba(168, 203, 255, 0.36)')
      haze.addColorStop(0.32, 'rgba(76, 104, 220, 0.21)')
      haze.addColorStop(0.62, 'rgba(29, 58, 138, 0.055)')
      haze.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = haze
      context.fillRect(0, 0, width, height)

      const core = context.createLinearGradient(0, coreY, width, coreY)
      core.addColorStop(0, 'rgba(71, 142, 255, 0)')
      core.addColorStop(0.21, 'rgba(83, 153, 255, 0.18)')
      core.addColorStop(0.48, 'rgba(235, 247, 255, 0.54)')
      core.addColorStop(0.53, 'rgba(255, 210, 143, 0.5)')
      core.addColorStop(0.8, 'rgba(100, 115, 241, 0.15)')
      core.addColorStop(1, 'rgba(74, 123, 255, 0)')
      context.save()
      context.filter = 'blur(7px)'
      context.fillStyle = core
      context.fillRect(0, coreY - 16, width, 32)
      context.restore()

      // Broad curved strokes make the river read as a rotating galaxy, not a line.
      context.save()
      context.filter = 'blur(3px)'
      for (let arm = 0; arm < 3; arm += 1) {
        const direction = arm === 1 ? -1 : 1
        const offset = (arm - 1) * height * 0.12
        context.beginPath()
        context.moveTo(-width * 0.06, coreY + offset + direction * height * 0.22)
        context.bezierCurveTo(width * 0.22, coreY - direction * height * 0.3, width * 0.62, coreY + direction * height * 0.22, width * 1.08, coreY + offset - direction * height * 0.17)
        context.strokeStyle = arm === 1 ? 'rgba(120, 164, 255, 0.2)' : 'rgba(255, 184, 118, 0.13)'
        context.lineWidth = 11 - arm * 2
        context.stroke()
      }
      context.restore()

      for (const star of STARS) {
        const progress = (star.x + time * star.speed) % 1
        const wave = Math.sin(progress * Math.PI * 2 + time * 0.055) * height * 0.12
        const curl = Math.sin(progress * Math.PI * 4 + star.phase) * height * 0.05 * star.depth
        const x = progress * width
        const y = coreY + wave + curl + star.spread * height * 0.48
        const edgeFade = Math.sin(progress * Math.PI)
        const density = Math.max(0, 1 - Math.abs(y - coreY) / (height * 0.58))
        const alpha = (0.16 + (1 - star.depth) * 0.74) * edgeFade * density
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
