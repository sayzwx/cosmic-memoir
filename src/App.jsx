import { useRef } from 'react'
import { Scene } from './components/Scene'
import { LoginOverlay } from './components/LoginOverlay'

export default function App() {
  const loginCardRef = useRef(null)

  return (
    <>
      <Scene loginCardRef={loginCardRef} />
      <LoginOverlay cardRef={loginCardRef} />
    </>
  )
}
