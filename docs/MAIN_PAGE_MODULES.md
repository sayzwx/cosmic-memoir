# CosmicMemoir Main Page Module Map

## Status

- Login page: completed and frozen.
- Current phase: main memoir page planning and optimization.
- Main page entry: `universe.html`.
- This document defines planning boundaries only. It does not prescribe a redesign.

## Module Overview

| ID | Module | Current files | Responsibility |
|---|---|---|---|
| M1 | Page shell and loading | `universe.html`, `js/auth-guard.js` | Page structure, authentication guard, WebGL canvas, loading and error states, font and script loading |
| M2 | Narrative UI and navigation | `universe.html`, `js/app.js` | Chapter title, narrative text, physics HUD, previous/next controls, progress indicators, completion copy. Approved specification: `docs/M2_NARRATIVE_UI_SPEC.md` |
| M3 | Application flow | `engine/App.js` | Initialization, chapter and memory order, scene changes, preloading, completion flow, cleanup |
| M4 | Scene routing and transitions | `engine/core/SceneRouter.js` | Dynamic renderer loading, scene mount/unmount, collapse and wormhole transitions, scene events |
| M5 | Input and responsive controls | `engine/core/InputAdapter.js` | Mouse, wheel, keyboard, touch and pinch input normalization and forwarding |
| M6 | Data and memoir content | `engine/core/DataLoader.js`, `data/memories.json` | Chapter data, narrative content, physics parameters, media references, sorting and caching |
| M7 | Rendering foundation and performance | `engine/core/CelestialRenderer.js`, `engine/core/PerformanceProfiler.js` | Three.js lifecycle, render loop, resize, quality levels, resource disposal and FPS adaptation |
| M8 | Dark matter chapter | `engine/renderers/DarkMatterRenderer.js` | Gravitational lensing, draggable galaxies, convergence and hidden-memory unlocking |
| M9 | Redshift chapter | `engine/renderers/RedshiftRenderer.js` | Timeline, redshift color and spacing, peculiar-velocity objects and capture interaction |
| M10 | Event horizon chapter | `engine/renderers/EventHorizonRenderer.js`, `engine/shaders/*` | Black hole, accretion disk, lensing post-processing, scroll descent and horizon crossing |
| M11 | Roche limit chapter | `engine/renderers/RocheLimitRenderer.js` | Binary stars, distance and density controls, tidal deformation, fragmentation and locking |
| M12 | Gravitational wave chapter | `engine/renderers/GravitationalWaveRenderer.js` | Binary inspiral, debris response, merger, ripples and ringdown |

## Planning Groups

The twelve implementation modules can be planned as four product-facing groups.

### A. Page Experience

Includes `M1` and `M2`.

Questions to plan:

- What information should remain visible while a scene is interactive?
- Should narrative text be centered, attached to an object, or opened as a reading panel?
- How should users understand current chapter, memory position and available interaction?
- What should the loading, scene failure and memoir completion states look like?
- What is the intended desktop and mobile layout?

### B. Journey and Controls

Includes `M3`, `M4` and `M5`.

Questions to plan:

- Is the experience linear, freely navigable, or chapter-selectable?
- Should previous/next navigation remain available during all interactions?
- What visual language should chapter transitions share?
- Which interactions need onboarding hints or an explicit reset action?
- How should keyboard, mouse and touch controls correspond?

### C. Content System

Includes `M6`.

Questions to plan:

- How many memories should each chapter contain?
- Which narrative fields are visible before, during and after interaction?
- Will real photos, audio or video be introduced?
- Are hidden memories needed, and what unlock rules should they use?
- Which parameters should remain editable through JSON rather than code?

### D. Visual Chapters

Includes `M8` through `M12`, supported by `M7`.

Each chapter can be optimized independently using the same checklist:

1. Emotional goal and one-sentence experience.
2. Main visual focal point.
3. Primary user interaction.
4. Narrative reveal sequence.
5. Success, completion or exit condition.
6. Desktop and mobile behavior.
7. Performance budget and visual fallback.

## Chapter Planning Cards

### M8 Dark Matter

- Current metaphor: invisible experiences shape visible choices.
- Current interaction: drag galaxies and converge lensing arcs.
- Planning decision: keep as the opening tutorial, or make hidden-memory discovery more explicit.

### M9 Redshift

- Current metaphor: distance and time stretch memories toward warmer wavelengths.
- Current interaction: drag a horizontal timeline and capture exceptional objects.
- Planning decision: prioritize chronological reading, visual color travel, or object collection.

### M10 Event Horizon

- Current metaphor: irreversible decisions and information that cannot return.
- Current interaction: scroll toward and cross the horizon.
- Planning decision: determine how irreversible the experience should really be and how users recover navigation.

### M11 Roche Limit

- Current metaphor: intimacy can stabilize, deform or fragment a relationship.
- Current interaction: alter distance and density, then lock or break the secondary body.
- Planning decision: choose whether this should feel scientific, emotional, game-like, or cinematic.

### M12 Gravitational Wave

- Current metaphor: a relationship ends, but its deformation continues through spacetime.
- Current interaction: tune the orbit and trigger a merger.
- Planning decision: define the final emotional payoff, ending copy and replay behavior.

## Shared Foundation Constraints

- Every chapter currently creates its own Three.js renderer through `CelestialRenderer`.
- Chapter renderers are dynamically imported by `SceneRouter`.
- Input must continue through `InputAdapter`; renderers should not add direct DOM listeners.
- Content and physics parameters should remain in `data/memories.json` where practical.
- Scene resources must be disposed when changing memories or chapters.
- Quality changes from `PerformanceProfiler` need to affect real renderer settings, not only report an FPS tier.
- External CDN dependencies currently include Three.js, Tailwind and web fonts; offline and slow-network behavior should be considered during optimization.

## Suggested Planning Order

1. M2 Narrative UI and navigation: establishes how the main page communicates.
2. M3 Application flow: decides linear versus free navigation and completion behavior.
3. M8 Dark matter: first scene and interaction tutorial.
4. M9 Redshift: validates repeated-memory browsing.
5. M10 Event horizon: highest visual and performance complexity.
6. M11 Roche limit: highest interaction and simulation complexity.
7. M12 Gravitational wave: final payoff and ending.
8. M1, M4, M5, M6 and M7: consolidate shared behavior after chapter requirements are clear.

## Planning Template

Use this template for each module before implementation:

```text
Module:
Goal:
Keep:
Remove:
Add:
Primary interaction:
Desktop behavior:
Mobile behavior:
Performance target:
Acceptance criteria:
```
