import { Canvas } from '@react-three/fiber'
import { GalaxyParticles } from './GalaxyParticles'
import { BlackHole } from './BlackHole'
import { AccretionDisk } from './AccretionDisk'
import { CameraRig } from './CameraRig'
import { PhotonSystem } from './PhotonSystem'
import { Effects } from './Effects'
import { useResponsive } from '../hooks/useResponsive'

export function Scene({ loginCardRef }) {
  const { isMobile, particleCount } = useResponsive()

  return (
    <Canvas
      camera={{
        position: [0, 8, -55],
        fov: 75,
        near: 0.1,
        far: 2000
      }}
      gl={{
        antialias: !isMobile,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true
      }}
      dpr={isMobile ? [1, 1] : [1, 2]}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1
      }}
    >
      <color attach="background" args={['#020205']} />
      <CameraRig loginCardRef={loginCardRef} />
      <GalaxyParticles count={particleCount} />
      <BlackHole />
      <AccretionDisk />
      <PhotonSystem />
      <Effects isMobile={isMobile} />
    </Canvas>
  )
}
