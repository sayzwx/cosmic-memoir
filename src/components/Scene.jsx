import { Canvas } from '@react-three/fiber'
import { NebulaBackground } from './NebulaBackground'
import { CompanionStars } from './CompanionStars'
import { GalaxyParticles } from './GalaxyParticles'
import { BlackHole } from './BlackHole'
import { AccretionDisk } from './AccretionDisk'
import { CameraRig } from './CameraRig'
import { PhotonSystem } from './PhotonSystem'
import { Effects } from './Effects'
import { EventHorizonTunnel } from './EventHorizonTunnel'
import { DistantCelestials } from './DistantCelestials'
import { NebulaStreaks } from './NebulaStreaks'
import { useResponsive } from '../hooks/useResponsive'

export function Scene({ loginCardRef, isLoginAwakened, onLoginAwaken }) {
  const { isMobile, particleCount } = useResponsive()

  return (
    <Canvas
      camera={{
        position: [0, 8, -55],
        fov: 70,
        near: 0.1,
        far: 2000
      }}
      gl={{
        // The composer renders through its own targets, so default-framebuffer
        // MSAA adds cost without smoothing the final image.
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true
      }}
      dpr={isMobile ? 1 : [1, 1.25]}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1
      }}
    >
      <NebulaBackground />
      <NebulaStreaks count={100} />
      <CameraRig loginCardRef={loginCardRef} />
      <CompanionStars hidden={isLoginAwakened} onActivate={onLoginAwaken} />
      <GalaxyParticles count={particleCount} />
      <DistantCelestials />
      <BlackHole />
      <AccretionDisk />
      <PhotonSystem />
      <EventHorizonTunnel />
      <Effects />
    </Canvas>
  )
}
