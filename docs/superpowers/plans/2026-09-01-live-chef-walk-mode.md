# Live Chef Avatars and Walk Kitchen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render smooth, recognizable chef workers from deterministic simulation frames and provide a collision-safe first-person kitchen walkthrough with standard controls.

**Architecture:** A generic agent interpolation layer converts discrete simulation frames into render poses. Procedural chef components consume those poses without altering simulation outcomes. A kinematic first-person controller uses pure input and collision modules, while browser-specific keyboard and pointer-lock behavior stays in thin React adapters.

**Tech Stack:** React Three Fiber, Drei PointerLockControls, Three.js, TypeScript, Vitest, Testing Library, Playwright; no physics engine or external character assets.

## Global Constraints

- Worker visuals must never change deterministic simulation results or metrics.
- Interpolate existing one-second frames; do not increase engine frame volume.
- Use procedural low-poly chefs and shared materials/geometries.
- First-person movement supports WASD, arrows, mouse-look, Space, Shift, and Escape.
- Ignore movement keys while an input, textarea, select, or contenteditable element has focus.
- Collide with walls, pillars, equipment, pass ledges, and floor.
- Simulated workers use soft proximity response and never deadlock the player.
- Other staff remain visible in Walk Kitchen.
- Respect reduced-motion preference.

---

## File Structure

- `src/core/agents/types.ts`: domain-neutral agent frames and render poses.
- `src/core/agents/interpolate-agent-frame.ts`: pure interpolation and heading logic.
- `src/features/scene/agents/ChefAvatar.tsx`: procedural swanky chef geometry and motion states.
- `src/features/scene/agents/SimulatedStaff.tsx`: frame sampling and avatar instances.
- `src/features/scene/walk/walk-input.ts`: input state reducer and focus safety.
- `src/features/scene/walk/walk-collision.ts`: pure kinematic collision and spawn logic.
- `src/features/scene/walk/FirstPersonController.tsx`: frame loop, gravity, jump, and pointer lock.
- `src/features/scene/walk/FirstPersonHands.tsx`: restrained chef sleeves/hands.
- `src/features/scene/walk/WalkControlsGuide.tsx`: accessible bottom-right guideline.
- `src/features/scene/walk/WalkScene.tsx`: mode composition.

### Task 1: Create Generic Agent Interpolation

**Files:**
- Create: `src/core/agents/types.ts`
- Create: `src/core/agents/interpolate-agent-frame.ts`
- Create: `src/core/agents/interpolate-agent-frame.test.ts`
- Modify: `src/simulation/types.ts`

**Interfaces:**
- Produces: `SpatialAgentFrame<TRole>`, `AgentRenderPose<TRole>`, and `interpolateAgentFrames(frames, elapsedSeconds)`.
- Kitchen `AgentFrame` specializes `SpatialAgentFrame<StaffRole>`.

- [ ] **Step 1: Write failing interpolation tests**

```ts
import { describe, expect, it } from 'vitest'
import { interpolateAgentFrames } from './interpolate-agent-frame'

describe('interpolateAgentFrames', () => {
  const frames = [
    { elapsedSeconds: 0, agents: [{ agentId: 'chef-1', role: 'chef', xMm: 0, yMm: 0, state: 'walking' as const }] },
    { elapsedSeconds: 1, agents: [{ agentId: 'chef-1', role: 'chef', xMm: 1000, yMm: 0, state: 'working' as const }] },
  ]

  it('smoothly interpolates position and heading without mutating frames', () => {
    expect(interpolateAgentFrames(frames, 0.5)[0]).toMatchObject({ xMm: 500, yMm: 0, headingRad: 0, moving: true })
    expect(frames[0].agents[0].xMm).toBe(0)
  })

  it('clamps before the first and after the last frame', () => {
    expect(interpolateAgentFrames(frames, -2)[0].xMm).toBe(0)
    expect(interpolateAgentFrames(frames, 9)[0].xMm).toBe(1000)
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/core/agents/interpolate-agent-frame.test.ts`

Expected: FAIL because agent core files are missing.

- [ ] **Step 3: Implement generic frame types and interpolation**

Define `SpatialAgentFrame<TRole extends string = string>` with ID, role, x/y, state, optional task ID. Define `AgentRenderPose` with interpolated x/y, `headingRad`, `moving`, and source state. Binary-search surrounding frames by `elapsedSeconds`, linearly interpolate matching IDs, preserve the earlier state until the midpoint, and calculate heading from the motion vector while retaining prior heading for stationary poses.

- [ ] **Step 4: Run core and simulation tests**

Run: `npm test -- src/core/agents/interpolate-agent-frame.test.ts src/simulation/engine.test.ts`

Expected: PASS and existing engine snapshots remain unchanged.

- [ ] **Step 5: Commit interpolation**

```bash
git add src/core/agents src/simulation/types.ts
git commit -m "feat: interpolate generic agent playback"
```

### Task 2: Build Procedural Swanky Chef Avatars

**Files:**
- Create: `src/features/scene/agents/ChefAvatar.tsx`
- Create: `src/features/scene/agents/chef-avatar.test.tsx`
- Create: `src/features/scene/agents/SimulatedStaff.tsx`
- Create: `src/features/scene/agents/role-style.ts`

**Interfaces:**
- Produces: `ChefAvatar({ pose, label, reducedMotion, player })` and `SimulatedStaff({ frames, elapsedSeconds, followRole, reducedMotion })`.

- [ ] **Step 1: Write failing visual-descriptor tests**

```ts
import { describe, expect, it } from 'vitest'
import { chefVisualDescriptor } from './ChefAvatar'

describe('ChefAvatar', () => {
  it('describes the approved chef silhouette and role styling', () => {
    expect(chefVisualDescriptor('head-chef', false).parts).toEqual(expect.arrayContaining([
      'toque', 'double-breasted-jacket', 'neckerchief', 'trousers', 'kitchen-shoes',
    ]))
    expect(chefVisualDescriptor('head-chef', true).accent).toBe('#b95f47')
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/agents/chef-avatar.test.tsx`

Expected: FAIL because the avatar is missing.

- [ ] **Step 3: Build a dimensioned low-poly chef**

Use a group whose feet sit at `y=0`, total height is approximately `1.72 m`, and body parts are simple capsules, cylinders, boxes, and spheres. Build a layered toque, white jacket with dark buttons, role-colored neckerchief/trim, dark trousers, and nonslip shoes. Export `chefVisualDescriptor(role, player)` for non-WebGL tests.

Animate arms and legs from `useFrame` using movement speed; working uses a restrained forearm gesture; waiting uses an idle pose. Disable cycle exaggeration when `reducedMotion` is true.

- [ ] **Step 4: Render interpolated staff with stable IDs**

`SimulatedStaff` calls `interpolateAgentFrames`, converts millimetres to world metres, eases rotation toward `headingRad`, renders one `ChefAvatar` per agent ID, and optionally adds a compact non-interactive name/task label. Use the established kitchen role colors.

- [ ] **Step 5: Run avatar and simulation tests**

Run: `npm test -- src/features/scene/agents src/core/agents src/simulation`

Expected: PASS.

- [ ] **Step 6: Commit chef avatars**

```bash
git add src/features/scene/agents
git commit -m "feat: render animated chef staff"
```

### Task 3: Implement Keyboard Input and Focus Safety

**Files:**
- Create: `src/features/scene/walk/walk-input.ts`
- Create: `src/features/scene/walk/walk-input.test.ts`

**Interfaces:**
- Produces: `WalkInputState`, `walkInputReducer`, `walkActionForKeyboardEvent`, and `isTextEntryTarget`.

- [ ] **Step 1: Write failing input tests**

```ts
import { describe, expect, it } from 'vitest'
import { walkActionForKeyboardEvent, walkInputReducer } from './walk-input'

describe('walk input', () => {
  it.each([
    ['w', 'forward'], ['ArrowUp', 'forward'], ['s', 'backward'], ['ArrowDown', 'backward'],
    ['a', 'left'], ['ArrowLeft', 'left'], ['d', 'right'], ['ArrowRight', 'right'],
    [' ', 'jump'], ['Shift', 'boost'], ['Escape', 'release'],
  ])('maps %s to %s', (key, control) => {
    expect(walkActionForKeyboardEvent({ key, repeat: false, target: document.body } as KeyboardEvent, true)?.control).toBe(control)
  })

  it('ignores controls while typing', () => {
    const input = document.createElement('input')
    expect(walkActionForKeyboardEvent({ key: 'w', target: input } as KeyboardEvent, true)).toBeNull()
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/walk/walk-input.test.ts`

Expected: FAIL because the input module is missing.

- [ ] **Step 3: Implement pure input mapping**

Use boolean fields `forward`, `backward`, `left`, `right`, `jump`, and `boost`. Keydown sets a field, keyup clears it, Escape emits a release action, and pointer-lock inactive state clears all movement. Treat input, textarea, select, and `contenteditable=true` as text entry.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/features/scene/walk/walk-input.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit input mapping**

```bash
git add src/features/scene/walk/walk-input.ts src/features/scene/walk/walk-input.test.ts
git commit -m "feat: map first-person kitchen controls"
```

### Task 4: Implement Kinematic Collision, Gravity, and D2 Spawn

**Files:**
- Create: `src/features/scene/walk/walk-collision.ts`
- Create: `src/features/scene/walk/walk-collision.test.ts`

**Interfaces:**
- Produces: `buildWalkColliders`, `resolveWalkStep`, `findD2Spawn`, `WalkBody`, and `WalkCollider`.

- [ ] **Step 1: Write failing collision tests**

```ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../../domain/seed-project'
import { buildWalkColliders, findD2Spawn, resolveWalkStep } from './walk-collision'

describe('walk collision', () => {
  const project = createSeedProject()
  const colliders = buildWalkColliders(project.architecture, project.variants[0].equipment)

  it('places the player inside D2 and blocks walls, equipment, pillar, and pass ledges', () => {
    const spawn = findD2Spawn(project.architecture, colliders)
    expect(spawn.xMm).toBeGreaterThan(0)
    expect(project.architecture.roomPolygon).toBeDefined()
    expect(colliders.map((collider) => collider.kind)).toEqual(expect.arrayContaining(['wall', 'equipment', 'pillar', 'pass-ledge']))
  })

  it('resolves a horizontal step without crossing a solid collider', () => {
    const result = resolveWalkStep({ positionMm: { x: 100, y: 1000 }, radiusMm: 260 }, { x: -400, y: 0 }, colliders)
    expect(result.positionMm.x).toBeGreaterThanOrEqual(260)
    expect(result.collided).toBe(true)
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/walk/walk-collision.test.ts`

Expected: FAIL because the collision module is missing.

- [ ] **Step 3: Build fixed colliders from canonical geometry**

Reuse `buildWallPanels` for wall rectangles, rotated equipment footprints for equipment, pillar footprints, and service-window fixtures for pass ledges. The player body is a 260 mm horizontal radius with 1,700 mm standing height. Exclude the floor grid, labels, clearances, storage-zone tint, and hood from horizontal collision.

- [ ] **Step 4: Implement swept 2D movement and spawn**

Resolve intended movement in substeps no longer than 80 mm, push the circular body out of axis-aligned/rotated footprint edges, and allow sliding along obstacles. `findD2Spawn` places the player 450 mm inside the D2 midpoint and calls the nearest valid free-point search if occupied.

Gravity state uses metres in the React controller, but pure horizontal collision remains millimetres. Floor height is zero; vertical state reports grounded when eye base reaches zero.

- [ ] **Step 5: Run collision, wall, geometry, and nav tests**

Run: `npm test -- src/features/scene/walk/walk-collision.test.ts src/features/scene/wall-geometry.test.ts src/domain/geometry.test.ts src/simulation/nav-grid.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit collision core**

```bash
git add src/features/scene/walk/walk-collision.ts src/features/scene/walk/walk-collision.test.ts
git commit -m "feat: add collision-safe kitchen walking"
```

### Task 5: Build the First-Person Controller and Chef Embodiment

**Files:**
- Create: `src/features/scene/walk/FirstPersonController.tsx`
- Create: `src/features/scene/walk/FirstPersonHands.tsx`
- Create: `src/features/scene/walk/WalkControlsGuide.tsx`
- Create: `src/features/scene/walk/WalkScene.tsx`
- Create: `src/features/scene/walk/walk-mode.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Produces: `WalkScene({ architecture, equipment, staff, active, onExit })`.
- Emits: `onExit()` on explicit exit or workspace change.

- [ ] **Step 1: Write failing controls-guide and mode tests**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WalkControlsGuide } from './WalkControlsGuide'

describe('WalkControlsGuide', () => {
  it('shows every approved control and exits accessibly', async () => {
    const onExit = vi.fn()
    render(<WalkControlsGuide locked={false} onExit={onExit} />)
    expect(screen.getByLabelText('Walk kitchen controls')).toHaveTextContent('WASD')
    expect(screen.getByLabelText('Walk kitchen controls')).toHaveTextContent('Arrow keys')
    expect(screen.getByLabelText('Walk kitchen controls')).toHaveTextContent('Space')
    expect(screen.getByLabelText('Walk kitchen controls')).toHaveTextContent('Shift')
    expect(screen.getByLabelText('Walk kitchen controls')).toHaveTextContent('Esc')
    await userEvent.click(screen.getByRole('button', { name: 'Exit walk mode' }))
    expect(onExit).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/walk/walk-mode.test.tsx`

Expected: FAIL because Walk components are missing.

- [ ] **Step 3: Implement pointer lock, camera motion, gravity, and jumping**

Use Drei `PointerLockControls`. On each `useFrame`, turn input into camera-relative horizontal motion at `1.45 m/s` or `2.35 m/s` with Shift, resolve horizontal collision through `resolveWalkStep`, integrate gravity at `-9.81 m/s²`, and apply a restrained `3.4 m/s` jump only while grounded. Set eye height to `1.68 m`.

On pointer-lock loss, clear movement immediately. Add a visible reticle. Respect `prefers-reduced-motion` by disabling camera bob.

- [ ] **Step 4: Add chef sleeves and the bottom-right guide**

Render two lightweight white-sleeve/hand groups attached to the camera with copper cuff accents. Keep them below the center reticle. Render the accessible guide outside Canvas with a `Click scene to look` status when unlocked and the explicit exit button.

- [ ] **Step 5: Run Walk tests and build**

Run: `npm test -- src/features/scene/walk && npm run build`

Expected: PASS and build exits 0.

- [ ] **Step 6: Commit first-person mode**

```bash
git add src/features/scene/walk src/app/styles.css
git commit -m "feat: add first-person kitchen walkthrough"
```

### Task 6: Add Overview Player Avatar and Soft Staff Proximity

**Files:**
- Modify: `src/features/scene/agents/ChefAvatar.tsx`
- Modify: `src/features/scene/agents/SimulatedStaff.tsx`
- Modify: `src/features/scene/walk/FirstPersonController.tsx`
- Create: `src/features/scene/walk/staff-proximity.ts`
- Create: `src/features/scene/walk/staff-proximity.test.ts`

**Interfaces:**
- Produces: `softenPlayerStep(position, intendedDelta, staffPoses): { delta, overlappingAgentIds }`.

- [ ] **Step 1: Write failing proximity tests**

```ts
import { expect, it } from 'vitest'
import { softenPlayerStep } from './staff-proximity'

it('slows movement near a worker without creating a hard deadlock', () => {
  const result = softenPlayerStep({ x: 0, y: 0 }, { x: 300, y: 0 }, [{ agentId: 'cdp-1', xMm: 350, yMm: 0 }])
  expect(result.delta.x).toBeGreaterThan(0)
  expect(result.delta.x).toBeLessThan(300)
  expect(result.overlappingAgentIds).toEqual(['cdp-1'])
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/walk/staff-proximity.test.ts`

Expected: FAIL because proximity logic is missing.

- [ ] **Step 3: Implement soft proximity and overview player styling**

Scale intended movement from `1` to `0.35` between 850 mm and 350 mm of another agent, but never return zero solely because of workers. Surface overlapping IDs for a small `Worker nearby` HUD warning. In Overview, render the player avatar with copper-accented jacket and toque only while Walk mode has an active saved player position.

- [ ] **Step 4: Run agent and walk tests**

Run: `npm test -- src/features/scene/agents src/features/scene/walk`

Expected: PASS.

- [ ] **Step 5: Commit proximity behavior**

```bash
git add src/features/scene/agents src/features/scene/walk
git commit -m "feat: add embodied chef proximity behavior"
```

### Task 7: Expose Walk Kitchen from the Normal 3D Workspace

**Files:**
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`
- Modify: `src/features/scene/KitchenScene.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Adds `SceneMode = CameraMode | 'walk'` to the workspace UI.
- Normal Walk mode uses static architecture/equipment and an empty staff-pose list.

- [ ] **Step 1: Write a failing workspace-mode test**

```tsx
it('enters and exits Walk Kitchen from the regular 3D workspace without remounting the renderer', async () => {
  const user = userEvent.setup()
  render(<SceneWorkspace renderer={FakeWalkCapableRenderer} />)
  const generation = screen.getByTestId('kitchen-scene').getAttribute('data-renderer-generation')
  await user.click(screen.getByRole('button', { name: 'Walk kitchen' }))
  expect(screen.getByLabelText('Walk kitchen controls')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Exit walk mode' }))
  expect(screen.getByRole('button', { name: 'Perspective' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByTestId('kitchen-scene')).toHaveAttribute('data-renderer-generation', generation)
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/scene-sync.test.tsx`

Expected: FAIL because the regular workspace has no Walk action.

- [ ] **Step 3: Integrate WalkScene without replacing the Canvas**

Add a `Walk kitchen` toolbar button. While active, disable `OrbitControls`, mount `WalkScene` inside the existing Canvas, and keep architecture/equipment groups mounted. Pass no simulation frames so the normal 3D walkthrough is calm and static. Exiting restores the previous Perspective camera rather than fitting the room.

The mode transition is state-only:

```ts
const [sceneMode, setSceneMode] = useState<SceneMode>('perspective')
const previousOverviewMode = useRef<CameraMode>('perspective')
const enterWalk = () => { previousOverviewMode.current = cameraMode; setSceneMode('walk') }
const exitWalk = () => setSceneMode(previousOverviewMode.current)
```

- [ ] **Step 4: Run scene and Walk tests**

Run: `npm test -- src/features/scene/scene-sync.test.tsx src/features/scene/walk`

Expected: PASS.

- [ ] **Step 5: Run build and commit**

Run: `npm run lint && npm run build && git diff --check`

Expected: all commands exit 0.

```bash
git add src/features/scene/SceneWorkspace.tsx src/features/scene/KitchenScene.tsx src/features/scene/scene-sync.test.tsx src/app/styles.css
git commit -m "feat: enter walk mode from 3d workspace"
```
