# CosmicMemoir Handover

## Project

Vite multi-page site:

- Login: React + React Three Fiber, `index.html`
- Memoir: Canvas/WebGL page, `universe.html`
- Online: https://sayzwx.github.io/cosmic-memoir/
- Local: `npm run dev` on `http://127.0.0.1:5174/`

## Current Login Experience

1. Deep-space nebula, background streaking star lights, layered celestial systems, and a central black hole.
2. Cursor is a DOM meteor with directional tail: `src/components/MeteorCursor.jsx`.
3. Clicking a companion star triggers a restrained particle burst, then wakes the form after 620 ms.
4. Login form appears as a flowing star-river input band, not an orbit card.
5. Authentication success triggers the 4-second black-hole flight and redirects to `universe.html` after 4.5 seconds.

## Important Implementation Notes

- `GalaxyParticles.jsx` + `shaders/galaxy.js`: one particle draw call for spiral arms and the inner accretion flow.
- Inner flow shape is fixed; only rotation/turbulence changes. Do not reintroduce time-accumulated radial drift.
- Mouse particle push applies only outside radius `13`; the inner capture zone is unaffected.
- `AccretionDisk.jsx` intentionally returns `null`. The former standalone ring geometry was removed because it visually separated from the spiral arms.
- `BlackHole.jsx`: event horizon, Fresnel photon shell, low-opacity lensing shell, and horizon dust.
- `NebulaStreaks.jsx`: 100 animated star-light streaks on the deep nebula shell.
- `DistantCelestials.jsx`: world-fixed, layered distant stellar systems. No physical comet objects remain.
- `CompanionStars.jsx`: companion star interaction and burst particles.
- `LoginOverlay.jsx` + `styles/login.css`: DOM form, star-river materialization, hint/error/submit state.

## Authentication

- Username: `mjsx`
- Password: `foo`
- Logic: `src/hooks/useAuth.js`
- Session timeout: 1 hour; clear with `?logout`.

## Main Files

| File | Purpose |
|---|---|
| `src/components/Scene.jsx` | R3F scene composition |
| `src/components/CameraRig.jsx` | Camera orbit and black-hole transition |
| `src/components/GalaxyParticles.jsx` | Spiral arms and unified inner accretion particles |
| `src/shaders/galaxy.js` | Galaxy motion, inner heating, capture-zone interaction rule |
| `src/components/BlackHole.jsx` | Event horizon and photon/lensing shells |
| `src/components/CompanionStars.jsx` | Clickable stars and collision burst |
| `src/components/LoginOverlay.jsx` | Login UI and authentication flow |
| `src/components/MeteorCursor.jsx` | Meteor pointer |
| `src/styles/login.css` | Login, meteor, star-river styles |
| `universe.html`, `js/`, `engine/`, `data/` | Memoir page |

## Commands

```powershell
npm run dev
npm run build
npm test
npx gh-pages -d dist -b gh-pages -m "deploy: message"
```

## Verification

- Tests: 79 Vitest tests
- Latest `npm run build`: passed
- Latest `npm test`: passed (79/79)
- Browser WebGL checks: no errors on the latest local previews

## Caution

- Keep the accretion flow in `GalaxyParticles`; standalone rings look disconnected.
- Preserve world-fixed deep-space objects; do not attach them to the camera.
- Screenshot files in the repo root are untracked and should not be committed unintentionally.
