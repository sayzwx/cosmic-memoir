import { useRef, useState } from 'react'
import { Scene } from './components/Scene'
import { LoginOverlay } from './components/LoginOverlay'

export default function App() {
  const loginCardRef = useRef(null)
  const [isLoginAwakened, setIsLoginAwakened] = useState(false)
  const awakenLogin = () => setIsLoginAwakened(true)

  return (
    <>
      <Scene
        loginCardRef={loginCardRef}
        isLoginAwakened={isLoginAwakened}
        onLoginAwaken={awakenLogin}
      />
      <LoginOverlay
        cardRef={loginCardRef}
        isAwakened={isLoginAwakened}
        onAwaken={awakenLogin}
      />
    </>
  )
}
