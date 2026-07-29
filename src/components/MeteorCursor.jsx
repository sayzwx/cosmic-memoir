import { useEffect, useRef } from 'react'

const TRAIL_LENGTH = 9

export function MeteorCursor() {
  const cursorRef = useRef(null)
  const trailRefs = useRef([])
  const pointer = useRef({ x: -100, y: -100, lastX: -100, lastY: -100, angle: 0 })

  useEffect(() => {
    let frame
    const onPointerMove = (event) => {
      const dx = event.clientX - pointer.current.lastX
      const dy = event.clientY - pointer.current.lastY
      if (Math.abs(dx) + Math.abs(dy) > 1) pointer.current.angle = Math.atan2(dy, dx)
      pointer.current.lastX = event.clientX
      pointer.current.lastY = event.clientY
      pointer.current.x = event.clientX
      pointer.current.y = event.clientY
    }
    const render = () => {
      const { x, y, angle } = pointer.current
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}rad)`
      }
      trailRefs.current.forEach((node, index) => {
        if (!node) return
        const distance = 13 + index * 8
        node.style.transform = `translate3d(${x - Math.cos(angle) * distance}px, ${y - Math.sin(angle) * distance}px, 0)`
      })
      frame = requestAnimationFrame(render)
    }
    window.addEventListener('pointermove', onPointerMove)
    frame = requestAnimationFrame(render)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="meteor-cursor" aria-hidden="true">
      {Array.from({ length: TRAIL_LENGTH }, (_, index) => (
        <i key={index} ref={(node) => { trailRefs.current[index] = node }} style={{ '--trail-index': index }} />
      ))}
      <b ref={cursorRef}><span /></b>
    </div>
  )
}
