# Immersive Full Sim Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate 2D Operations, 3D Overview, and Walk Kitchen into one uninterrupted Full Sim session with live chefs, outgoing pass animation, persistent metrics, reliable WebGL recovery, and complete browser verification.

**Architecture:** A `useSimulationSession` hook owns run, playback, elapsed time, speed, live state, and view-independent settings. Presentation components consume the same session without recreating results. The existing 2D SVG remains the analytical surface; a dedicated 3D service scene reuses architecture, equipment, clearances, chef avatars, and Walk mode from earlier plans.

**Tech Stack:** React 19, Zustand, React Three Fiber, Drei, Three.js, TypeScript, Vitest, Testing Library, Playwright.

## Global Constraints

- Switching Full Sim views must not rerun or reset the simulation.
- Playback, backlog, ticket rail, metrics, queues, and findings remain synchronized across all views.
- Completed orders visibly cross the clean pass; dirty returns remain visually distinct.
- Other staff remain visible in Walk Kitchen.
- Use one WebGL Canvas per active 3D simulation surface.
- Reuse the context-loss recovery path and conservative DPR/shadow settings.
- Preserve mobile access to playback and exit controls.
- Maintain the comparative-planning disclaimer.

---

## File Structure

- `src/features/simulation/useSimulationSession.ts`: run and playback orchestration.
- `src/features/simulation/SimulationViewSwitcher.tsx`: accessible 2D/3D/Walk selector.
- `src/features/simulation/SimulationThreeScene.tsx`: shared 3D simulation Canvas.
- `src/features/simulation/CompletedOrderFlow.tsx`: pass-crossing order markers.
- `src/features/simulation/SimulationWorkspace.tsx`: layout composition only.
- `src/features/scene/SceneCanvas.tsx`: reusable resilient Canvas shell extracted from `SceneWorkspace`.
- `src/features/scene/SceneContent.tsx`: reusable architecture/equipment/clearance composition.
- `src/app/styles.css`: view selector, 3D HUD, Walk HUD, and responsive layout.
- `e2e/kitchen-lab.spec.ts`: end-to-end simulation, walking, persistence, and recovery.

### Task 1: Extract a View-Independent Simulation Session

**Files:**
- Create: `src/features/simulation/useSimulationSession.ts`
- Create: `src/features/simulation/use-simulation-session.test.tsx`
- Modify: `src/features/simulation/SimulationWorkspace.tsx`

**Interfaces:**
- Produces: `useSimulationSession({ input, run }): SimulationSession`.
- `SimulationSession` exposes `result`, `liveState`, `elapsedSeconds`, `playing`, `speed`, `startRun`, `setPlaying`, `setSpeed`, and `setElapsedSeconds`.

- [ ] **Step 1: Write a failing hook-preservation test**

```tsx
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { runSimulation } from '../../simulation/engine'
import { useSimulationSession } from './useSimulationSession'

describe('useSimulationSession', () => {
  it('keeps one result while presentation views change outside the hook', () => {
    const project = createSeedProject()
    const run = vi.fn(runSimulation)
    const input = { architecture: project.architecture, equipment: project.variants[0].equipment, scenario: project.scenarios[0] }
    const { result, rerender } = renderHook(({ marker }) => ({ marker, session: useSimulationSession({ input, run }) }), { initialProps: { marker: '2d' } })
    act(() => result.current.session.startRun())
    const first = result.current.session.result
    rerender({ marker: '3d' })
    expect(result.current.session.result).toBe(first)
    expect(run).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/simulation/use-simulation-session.test.tsx`

Expected: FAIL because the hook is missing.

- [ ] **Step 3: Extract existing playback logic into the hook**

Move result/time/playing/speed state, requestAnimationFrame advancement, `deriveLiveServiceState`, and start-run behavior from `SimulationWorkspace`. Accept a validated `SimulationInput`; do not store the presentation view in the hook. Preserve the current 1/5/25/100 playback speeds and end-of-service behavior.

- [ ] **Step 4: Refactor SimulationWorkspace to consume the hook**

Keep scenario validation and scenario editing in the workspace. Pass hook state to existing 2D scene, HUD, and playback controls. Confirm the current run button and empty state remain unchanged.

- [ ] **Step 5: Run simulation tests**

Run: `npm test -- src/features/simulation src/simulation`

Expected: PASS.

- [ ] **Step 6: Commit session extraction**

```bash
git add src/features/simulation/useSimulationSession.ts src/features/simulation/use-simulation-session.test.tsx src/features/simulation/SimulationWorkspace.tsx
git commit -m "refactor: preserve full sim session across views"
```

### Task 2: Extract a Reusable Resilient Scene Canvas

**Files:**
- Create: `src/features/scene/SceneCanvas.tsx`
- Create: `src/features/scene/SceneContent.tsx`
- Modify: `src/features/scene/SceneWorkspace.tsx`
- Modify: `src/features/scene/KitchenScene.tsx`
- Modify: `src/features/scene/scene-sync.test.tsx`

**Interfaces:**
- Produces: `SceneCanvas({ cameraMode, fitSignal, architecture, children, onContextState })` and `SceneContent({ project, variant, ...visualFlags })`.

- [ ] **Step 1: Add a failing reuse/recovery test**

```tsx
it('uses the same resilient canvas contract for normal and simulation content', async () => {
  render(<SceneCanvasHarness />)
  expect(screen.getByTestId('scene-content')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: 'Lose context' }))
  expect(screen.getByRole('alert')).toHaveTextContent('3D rendering paused')
  await userEvent.click(screen.getByRole('button', { name: 'Restart 3D renderer' }))
  expect(screen.getByTestId('scene-content')).toBeVisible()
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/scene/scene-sync.test.tsx`

Expected: FAIL because `SceneCanvas` is not extracted.

- [ ] **Step 3: Extract Canvas, camera, controls, and context guard**

Move the current conservative Canvas configuration, `WebGLContextGuard`, `CameraRig`, recovery UI, and `OrbitControls` into `SceneCanvas`. Accept children so normal and simulation scenes share the renderer shell. Keep `dpr={[1, 1.5]}`, basic shadows, no stencil, no preserved drawing buffer, and high-performance preference.

- [ ] **Step 4: Extract reusable scene content**

`SceneContent` renders background, lights, `ArchitectureMesh`, registered `EquipmentMesh` instances, `Clearances`, and grid. `KitchenScene` becomes a compatibility wrapper or is removed after all imports switch to `SceneContent`.

- [ ] **Step 5: Run scene tests and build**

Run: `npm test -- src/features/scene && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the reusable scene shell**

```bash
git add src/features/scene
git commit -m "refactor: share resilient 3d scene canvas"
```

### Task 3: Add the Full Sim View Selector and 3D Overview

**Files:**
- Create: `src/features/simulation/SimulationViewSwitcher.tsx`
- Create: `src/features/simulation/SimulationThreeScene.tsx`
- Modify: `src/features/simulation/SimulationWorkspace.tsx`
- Modify: `src/features/simulation/simulation-workspace.test.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Adds `SimulationView = 'operations-2d' | 'overview-3d' | 'walk'`.
- `SimulationThreeScene` consumes the shared `SimulationSession`, project, variant, layers, and view.

- [ ] **Step 1: Write failing view-switch persistence tests**

```tsx
it('switches among 2D Operations, 3D Overview, and Walk Kitchen without rerunning', async () => {
  const run = vi.fn(runSimulation)
  render(<SimulationWorkspace run={run} />)
  await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
  fireEvent.change(screen.getByLabelText(/Simulation time/i), { target: { value: '900' } })
  await userEvent.click(screen.getByRole('button', { name: '3D Overview' }))
  expect(screen.getByTestId('simulation-3d-scene')).toBeVisible()
  await userEvent.click(screen.getByRole('button', { name: '2D Operations' }))
  expect(screen.getByLabelText(/Simulation time/i)).toHaveValue('900')
  expect(run).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/simulation/simulation-workspace.test.tsx`

Expected: FAIL because view controls and 3D simulation are missing.

- [ ] **Step 3: Implement accessible view selection**

Render three text buttons with `aria-pressed`: `2D Operations`, `3D Overview`, and `Walk Kitchen`. Store view in `SimulationWorkspace`, outside `useSimulationSession`. Do not conditionally unmount the HUD, order rail data, sidebar metrics, or playback controls.

- [ ] **Step 4: Compose the 3D overview**

Render `SceneCanvas` and `SceneContent`, then add `SimulatedStaff` using session frames and elapsed time. Pass existing clearance and trail layer states. Keep compact live backlog/served/wait cards over the upper-left of the scene and keep ticket data accessible.

- [ ] **Step 5: Run component tests and build**

Run: `npm test -- src/features/simulation src/features/scene && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit 3D Full Sim**

```bash
git add src/features/simulation/SimulationViewSwitcher.tsx src/features/simulation/SimulationThreeScene.tsx src/features/simulation/SimulationWorkspace.tsx src/features/simulation/simulation-workspace.test.tsx src/app/styles.css
git commit -m "feat: add live 3d full sim view"
```

### Task 4: Animate Completed Orders Through the Clean Pass

**Files:**
- Create: `src/features/simulation/CompletedOrderFlow.tsx`
- Create: `src/features/simulation/completed-order-flow.test.ts`
- Modify: `src/features/simulation/SimulationThreeScene.tsx`
- Modify: `src/features/simulation/SimulationScene.tsx`

**Interfaces:**
- Produces: `completedOrderPose(order, elapsedSeconds, architecture)` and `CompletedOrderFlow`.

- [ ] **Step 1: Write failing pass-crossing tests**

```ts
import { describe, expect, it } from 'vitest'
import { createSeedProject } from '../../domain/seed-project'
import { completedOrderPose } from './CompletedOrderFlow'

describe('completedOrderPose', () => {
  it('moves an order from inside to outside through the configured clean-window center', () => {
    const architecture = createSeedProject().architecture
    const start = completedOrderPose({ id: 'order-1', completedAtSeconds: 100 }, 100, architecture)
    const end = completedOrderPose({ id: 'order-1', completedAtSeconds: 100 }, 104, architecture)
    expect(start.visible).toBe(true)
    expect(end.xMm).toBeGreaterThan(architecture.widthMm)
    expect(start.yMm).toBe(2500)
  })
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/simulation/completed-order-flow.test.ts`

Expected: FAIL because the flow module is missing.

- [ ] **Step 3: Implement opening-derived order motion**

Find the opening with `flow === 'clean-out'`, derive its midpoint from offset/width, and animate each recently completed ticket over four seconds from 350 mm inside the window to 650 mm outside. Offset concurrent tickets vertically and fade only after crossing the wall.

- [ ] **Step 4: Render recognizable ticket/tray markers in 2D and 3D**

Use a small stainless tray with a role-colored ticket card in 3D. Update the 2D marker path to derive its anchor from the clean opening instead of fixed `3880/2450` constants.

- [ ] **Step 5: Run flow and live-state tests**

Run: `npm test -- src/features/simulation/completed-order-flow.test.ts src/simulation/live-state.test.ts src/features/simulation/simulation-workspace.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit pass flow**

```bash
git add src/features/simulation/CompletedOrderFlow.tsx src/features/simulation/completed-order-flow.test.ts src/features/simulation/SimulationThreeScene.tsx src/features/simulation/SimulationScene.tsx
git commit -m "feat: animate orders through the clean pass"
```

### Task 5: Integrate Walk Kitchen with Live Service

**Files:**
- Modify: `src/features/simulation/SimulationThreeScene.tsx`
- Modify: `src/features/simulation/SimulationWorkspace.tsx`
- Modify: `src/features/simulation/simulation-workspace.test.tsx`
- Modify: `src/features/scene/walk/WalkScene.tsx`
- Modify: `src/app/styles.css`

**Interfaces:**
- Walk view consumes the same interpolated staff poses and session elapsed time as 3D Overview.
- View exit returns to `overview-3d` without resetting playback.

- [ ] **Step 1: Write failing live-walk integration tests**

```tsx
it('keeps workers and playback alive in Walk Kitchen and returns to overview', async () => {
  render(<SimulationWorkspace run={runSimulation} />)
  await userEvent.click(screen.getByRole('button', { name: /Run 60-minute service/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Walk Kitchen' }))
  expect(screen.getByLabelText('Walk kitchen controls')).toBeVisible()
  expect(screen.getByTestId('simulated-staff')).toHaveAttribute('data-count', '5')
  await userEvent.click(screen.getByRole('button', { name: 'Exit walk mode' }))
  expect(screen.getByRole('button', { name: '3D Overview' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText(/Live backlog/i)).toBeVisible()
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm test -- src/features/simulation/simulation-workspace.test.tsx`

Expected: FAIL because live Walk integration is missing.

- [ ] **Step 3: Compose WalkScene inside the simulation Canvas**

Disable orbit controls while Walk is active, mount the first-person controller and hands, keep `SceneContent`, `SimulatedStaff`, and `CompletedOrderFlow` mounted, and pass current worker poses to soft proximity logic. Exiting Walk changes only the presentation view.

- [ ] **Step 4: Protect playback controls from keyboard capture**

When pointer lock is active, Space prevents page scrolling; when unlocked or a form control has focus, existing simulation inputs work normally. Keep the bottom-right Walk guide above scene chrome but below modal/alert layers.

- [ ] **Step 5: Run simulation, walk, and accessibility tests**

Run: `npm test -- src/features/simulation src/features/scene/walk`

Expected: PASS.

- [ ] **Step 6: Commit live Walk integration**

```bash
git add src/features/simulation src/features/scene/walk/WalkScene.tsx src/app/styles.css
git commit -m "feat: walk through live kitchen service"
```

### Task 6: Complete Browser, Performance, Recovery, and Documentation Verification

**Files:**
- Modify: `e2e/kitchen-lab.spec.ts`
- Modify: `docs/user-guide.md`
- Modify: `src/app/styles.css`
- Modify: `src/features/scene/SceneCanvas.tsx`
- Modify: `src/features/simulation/SimulationThreeScene.tsx`

**Interfaces:**
- No new public API; this task closes spec acceptance criteria.

- [ ] **Step 1: Add the complete browser workflow before final styling changes**

Extend Playwright coverage to:

```ts
test('runs immersive service and walks the live kitchen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await page.getByRole('button', { name: 'Clearances' }).click()
  await page.getByRole('button', { name: 'Transparent walls' }).click()
  await expect(page.getByText(/Clean pass · orders out/i)).toBeVisible()
  await page.getByRole('button', { name: 'Simulate' }).click()
  await page.getByRole('button', { name: /Run 60-minute service/i }).click()
  await page.getByRole('button', { name: '3D Overview' }).click()
  await expect(page.getByTestId('simulated-staff')).toHaveAttribute('data-count', '5')
  await page.getByRole('button', { name: 'Walk Kitchen' }).click()
  await expect(page.getByLabelText('Walk kitchen controls')).toBeVisible()
  await page.keyboard.down('w')
  await page.waitForTimeout(250)
  await page.keyboard.up('w')
  await page.keyboard.press('Space')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Exit walk mode' }).click()
  await expect(page.getByText(/Live backlog/i)).toBeVisible()
  expect(errors).toEqual([])
})
```

- [ ] **Step 2: Run the new browser test and record concrete failures**

Run: `npm run e2e -- --grep "immersive service"`

Expected: any failure identifies a missing visibility, input, or integration behavior; fix only those concrete failures.

- [ ] **Step 3: Verify context recovery in normal and simulation 3D**

In the existing context-loss test, repeat synthetic `webglcontextlost` in `3D Overview`, restart, and assert chefs, the pass, and the live HUD return with the same elapsed simulation time. Repeatedly switch 2D → 3D → Walk → 3D and assert no detached labels, `THREE.WebGLRenderer: Context Lost` console warning, or extra Canvas elements.

- [ ] **Step 4: Finish responsive and reduced-motion styling**

At widths below 720 px, keep playback, view exit, backlog, and Walk guide accessible; collapse secondary metrics. Under `prefers-reduced-motion: reduce`, remove camera bob, limb exaggeration, pulsing clearance labels, and nonessential CSS transitions.

- [ ] **Step 5: Update the user guide**

Document 2D/3D/Walk Full Sim views, role avatars, pass flow, wall transparency, clearance legend, pointer-lock entry/exit, WASD/arrows/Space/Shift/Escape, collision behavior, and the tool-ready command boundary. State explicitly that WebMCP protocol exposure is phase two.

- [ ] **Step 6: Run the complete verification suite**

Run: `npm run lint && npm test && npm run build && npm run e2e && git diff --check`

Expected: lint exits 0; all Vitest files pass; production build exits 0; all Playwright tests pass; diff check exits 0.

- [ ] **Step 7: Commit the verified immersive release**

```bash
git add e2e/kitchen-lab.spec.ts docs/user-guide.md src/app/styles.css src/features/scene/SceneCanvas.tsx src/features/simulation/SimulationThreeScene.tsx
git commit -m "test: verify immersive kitchen service"
```

