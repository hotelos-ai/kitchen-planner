import { expect, test, type Page } from '@playwright/test'
import { createSeedProject } from '../src/domain/seed-project'

async function openApp(page: Page) {
  await page.goto('/')
  const starter = page.getByRole('button', { name: /Simple starter kitchen/i })
  try {
    await starter.waitFor({ state: 'visible', timeout: 3000 })
    await starter.click()
  } catch {
    // returning session: workspace already loaded
  }
  await expect(page.getByRole('heading', { name: /CalmKitchen Designer/i })).toBeVisible()
  await page.getByRole('button', { name: '2 Fit-out' }).click()
}


test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('edits, simulates, compares, exports, and restores the example kitchen', async ({ page }) => {
  await openApp(page)
  await expect(page.getByRole('heading', { name: /CalmKitchen Designer/i })).toBeVisible()

  await page.getByRole('tab', { name: /Placed/i }).click()
  await page.getByRole('button', { name: /Select Tandoor, 700 mm by 700 mm/i }).click()
  await page.getByLabel(/Lock dimensions/i).uncheck()
  await page.getByLabel(/^Width \(mm\)$/i).fill('750')
  await page.getByLabel(/^Width \(mm\)$/i).press('Tab')
  await page.locator('.canvas-footer').click()
  await page.keyboard.press('Escape')
  await page.getByLabel(/Display units/i).selectOption('ft')
  await page.getByLabel(/Display units/i).selectOption('mm')
  await page.getByRole('button', { name: /Select Tandoor/i }).click()
  await expect(page.getByLabel(/^Width \(mm\)$/i)).toHaveValue('750')

  await page.getByRole('button', { name: /Add custom item/i }).click()
  await page.getByLabel(/New item label/i).fill('Rice warmer')
  await page.getByRole('button', { name: /Add to plan/i }).click()
  await expect(page.getByLabel(/Equipment label/i)).toHaveValue('Rice warmer')
  await page.getByRole('button', { name: /Remove selected item/i }).click()
  await page.getByRole('button', { name: /Confirm remove selected item/i }).click()
  await expect(page.getByRole('button', { name: /Select Rice warmer/i })).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('button', { name: /Select Rice warmer/i })).toBeVisible()

  await page.getByRole('button', { name: /3D/i }).click()
  await expect(page.getByTestId('kitchen-scene')).toBeVisible()
  await page.getByRole('button', { name: /Select Tandoor in 3D/i }).click()
  await page.getByRole('button', { name: /Plan/i }).click()
  await expect(page.getByLabel(/Equipment label/i)).toHaveValue('Tandoor')

  await page.getByRole('button', { name: 'Layout A actions' }).click()
  await page.getByRole('menuitem', { name: 'New layout from wizard' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Create layout' }).click()
  await expect(page.getByLabel(/Active layout variant/i)).toHaveValue(/layout-/)
  await page.getByRole('button', { name: /Select Tandoor/i }).click()
  await page.getByLabel(/^X position \(mm\)$/i).fill('2300')
  await page.getByLabel(/^X position \(mm\)$/i).press('Tab')

  await page.getByRole('button', { name: /Simulate/i }).click()
  await page.getByRole('button', { name: /Run 60-minute service/i }).click()
  await expect(page.getByText(/Total staff travel/i)).toBeVisible()
  await expect(page.getByLabel(/Simulation time/i)).toBeVisible()
  await expect(page.getByLabel(/Live service status/i)).toContainText(/Live backlog/i)
  await expect(page.getByText(/Wait-time distribution/i)).toBeVisible()
  await expect(page.getByText(/Layout verdict/i)).toBeVisible()
  await page.getByLabel(/Simulation time/i).fill('2000')
  await expect(page.getByLabel(/Live station queues/i)).toBeVisible()

  await page.getByRole('button', { name: /Compare/i }).click()
  await expect(page.getByRole('heading', { name: /Priority findings/i })).toBeVisible()
  await expect(page.getByText(/50 covers over 60 minutes/i)).toBeVisible()
  await expect(page.getByText(/Comparative planning aid/i)).toBeVisible()

  const variantsBeforeExchange = await page.getByLabel(/Active layout variant/i).locator('option').allTextContents()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Save project/i }).click()
  const download = await downloadPromise
  const exportedPath = await download.path()
  expect(exportedPath).toBeTruthy()
  await page.getByLabel(/Open project JSON/i).setInputFiles(exportedPath!)
  await expect(page.getByRole('status')).toContainText(/Opened/i)
  await expect.poll(() => page.getByLabel(/Active layout variant/i).locator('option').allTextContents()).toEqual(variantsBeforeExchange)
})

test('creates an advanced room and recommended essentials through the novice wizard', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'Layout A actions' }).click()
  await page.getByRole('menuitem', { name: 'New layout from wizard' }).click()
  const wizard = page.getByRole('dialog')

  await wizard.getByLabel('Layout name').fill('Jagged service concept')
  await wizard.getByRole('radio', { name: 'Advanced polygon room' }).check()
  await wizard.getByRole('button', { name: 'Next' }).click()
  await wizard.getByRole('button', { name: 'Add wall vertex' }).click()
  await wizard.getByRole('button', { name: 'Add service window' }).click()
  await wizard.getByRole('button', { name: 'Add pillar' }).click()
  await wizard.getByRole('button', { name: 'Add storage zone' }).click()
  await wizard.getByRole('button', { name: 'Next' }).click()

  await wizard.getByLabel('Covers').fill('180')
  await wizard.getByLabel('Peak duration (minutes)').fill('90')
  await wizard.getByLabel('Arrival pattern').selectOption('two-waves')
  await wizard.getByLabel('Head chef count').fill('2')
  await wizard.getByRole('button', { name: 'Next' }).click()
  await wizard.getByText(/Handwash sink/).locator('input').check()
  await wizard.getByRole('button', { name: 'Next' }).click()

  await expect(wizard.getByRole('heading', { name: 'Review new layout' })).toBeVisible()
  await expect(wizard).toContainText('180 covers')
  await expect(wizard).toContainText(/1 service window.*1 pillar.*1 storage zone/)
  await wizard.getByRole('button', { name: 'Create layout' }).click()

  await expect(wizard).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Jagged service concept/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: /Validate/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Validate plan' })).toContainText(/operational guidance, not regulatory certification/i)
})

test('runs, inspects, compares, and atomically adopts an auto-layout finalist', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openApp(page)
  await page.getByRole('button', { name: 'Auto-layout' }).click()
  await expect(page.getByRole('heading', { name: 'Auto-layout' })).toBeVisible()
  await page.getByLabel('Maximum evaluations').fill('8')
  await page.getByLabel('Time budget (seconds)').fill('10')
  await page.getByRole('button', { name: 'Run auto-layout' }).click()

  const fastest = page.getByTestId('finalist-fastest-service')
  await expect(fastest).toBeVisible({ timeout: 30_000 })
  await expect(fastest).toContainText(/Hard feasible/i)
  await expect(fastest).toContainText(/Seeds.*3, 5.*101/i)
  await page.getByRole('button', { name: 'Inspect Fastest service' }).click()
  await expect(page.getByRole('region', { name: 'Inspected finalist' })).toBeVisible()
  await page.getByRole('button', { name: 'Compare Least travel' }).click()
  await expect(page.getByRole('region', { name: 'Finalist comparison' })).toBeVisible()
  await page.getByRole('button', { name: 'Save Minimal change as new layout' }).click()
  await expect(page.getByRole('status')).toContainText(/saved as a new layout/i)

  await page.getByRole('button', { name: 'Auto-layout', exact: true }).click()
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await expect(page.getByRole('tab', { name: /Minimal change/ })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('keeps the full simulation readable at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)
  await page.getByRole('button', { name: /Simulate/i }).click()
  await page.getByRole('button', { name: /Run 60-minute service/i }).click()

  const liveStatus = page.getByLabel(/Live service status/i)
  await expect(liveStatus).toBeVisible()
  await expect(liveStatus).toContainText(/Average served wait/i)
  await expect(page.getByLabel(/Live order tickets/i)).toBeVisible()
  await expect(page.getByText(/Wait-time distribution/i)).toBeVisible()

  expect(await liveStatus.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(3)
  expect(await page.getByLabel(/Live station queues/i).evaluate((element) => getComputedStyle(element).left)).toBe('10px')
})

test('keeps Plan controls and canvas in the phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)

  const workspace = page.getByRole('region', { name: '2D plan workspace' })
  const toolbarBox = await page.locator('.app-header-row-2').boundingBox()
  const canvasBox = await page.getByTestId('plan-canvas').boundingBox()

  expect(toolbarBox).not.toBeNull()
  expect(toolbarBox!.height).toBeLessThan(180)
  expect(canvasBox).not.toBeNull()
  expect(canvasBox!.y).toBeLessThan(500)
  expect(canvasBox!.height).toBeGreaterThan(200)
  expect(canvasBox!.y + canvasBox!.height).toBeLessThanOrEqual(844)
})

test('resizes the desktop Plan canvas without remounting it when drawers collapse', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page)
  const canvas = page.getByTestId('plan-canvas')
  const before = await canvas.boundingBox()
  const nodeIdentity = await canvas.evaluate((node) => { (window as unknown as { planCanvasNode?: Element }).planCanvasNode = node; return true })

  await page.getByRole('button', { name: 'Toggle equipment catalog' }).click()
  await page.getByRole('button', { name: 'Toggle inspector' }).click()
  await page.waitForTimeout(350)
  const after = await canvas.boundingBox()

  expect(nodeIdentity).toBe(true)
  expect(await canvas.evaluate((node) => (window as unknown as { planCanvasNode?: Element }).planCanvasNode === node)).toBe(true)
  expect(after!.width).toBeGreaterThan(before!.width + 400)
})

test('keeps every 3D control usable and recovers a lost WebGL context', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openApp(page)
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(page.getByTestId('kitchen-scene').locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Top', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Perspective', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Perspective', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Fit room', exact: true }).click()
  await page.getByRole('button', { name: 'Clearances', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Clearances', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.clearance-label').first()).toBeVisible()
  await page.getByRole('button', { name: 'Transparent walls', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Transparent walls', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const scene = page.getByTestId('kitchen-scene')
  await expect(scene.getByText('Clean pass · orders out')).toBeVisible()
  await expect(page.getByText('Dirty return · dishes in')).toBeVisible()
  await page.getByRole('button', { name: /Select Tandoor in 3D/i }).click()

  await page.getByTestId('kitchen-scene').locator('canvas').evaluate((node) => {
    node.dispatchEvent(new Event('webglcontextlost', { bubbles: false, cancelable: true }))
  })
  await expect(page.getByRole('alert')).toContainText(/3D rendering paused/i)
  await page.getByRole('button', { name: /Restart 3D renderer/i }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByTestId('kitchen-scene').locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await expect(page.getByLabel(/3D kitchen workspace/i)).toBeVisible()
  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await page.getByRole('button', { name: 'Fit room', exact: true }).click()
  expect(pageErrors).toEqual([])
})

test('keeps overview 3D mounted when no safe Walk spawn exists', async ({ page }) => {
  const project = createSeedProject()
  project.variants[0].equipment = [{
    id: 'blocked-room',
    label: 'Blocked room test fixture',
    category: 'custom',
    xMm: 0,
    yMm: 0,
    widthMm: project.architecture.widthMm,
    depthMm: project.architecture.depthMm,
    heightMm: 2500,
    rotationDeg: 0,
    dimensionsLocked: true,
    movable: false,
    removable: false,
    capabilities: [],
  }]
  await page.addInitScript(({ json }) => {
    localStorage.setItem('manta-raja:project:v1', json)
  }, { json: JSON.stringify(project) })

  await openApp(page)
  await page.getByRole('button', { name: '3D', exact: true }).click()
  const scene = page.getByTestId('kitchen-scene')
  const canvas = scene.locator('canvas')
  await expect(canvas).toBeVisible()
  await page.getByRole('button', { name: 'Walk kitchen', exact: true }).click()

  await expect(page.getByRole('alert')).toContainText(/No safe walkthrough start/i)
  await expect(canvas).toBeVisible()
  await expect(scene).toHaveAttribute('data-renderer-generation', '0')

  await page.getByRole('button', { name: 'Return to 3D overview' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(canvas).toBeVisible()
  await expect(scene).toHaveAttribute('data-renderer-generation', '0')
})

test('applies a typical equipment configuration and reflects it in 3D', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openApp(page)
  await page.getByRole('tab', { name: /Placed/i }).click()

  await page.getByRole('button', { name: /Select 2-door fridge, 1400 mm by 850 mm/i }).click()
  await expect(page.getByLabel('Equipment configuration')).toHaveValue('cold-upright-double')
  await expect(page.getByText(/Typical configuration · modified/i)).toBeVisible()
  await page.getByLabel('Equipment configuration').selectOption('cold-chest-freezer')

  await expect(page.getByLabel('Equipment label')).toHaveValue('Chest freezer')
  await expect(page.getByLabel(/^Width \(mm\)$/i)).toHaveValue('1200')
  await expect(page.getByLabel(/^Depth \(mm\)$/i)).toHaveValue('700')
  await expect(page.getByLabel(/^Height \(mm\)$/i)).toHaveValue('850')
  await expect(page.getByText(/Applies typical size, clearance, capabilities, and 3D skin/i)).toBeVisible()

  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(page.getByTestId('kitchen-scene').locator('canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: /Select Chest freezer in 3D/i })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('switches live walk cameras while preserving movement and adaptive jump state', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await openApp(page)
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await page.getByRole('button', { name: 'Walk kitchen', exact: true }).click()

  const scene = page.getByTestId('kitchen-scene')
  await scene.locator('canvas').click()
  await expect(scene).toHaveAttribute('data-player-x-mm', /\d+/)
  await expect(scene).toHaveAttribute('data-player-y-mm', /\d+/)
  await expect(page.getByLabel('Walk kitchen controls')).toContainText('A/D')
  await expect(page.getByLabel('Walk kitchen controls')).toContainText('Left/Right arrows')
  await expect(page.getByLabel('Walk kitchen controls')).toContainText('Click · F')

  const rendererGeneration = await scene.getAttribute('data-renderer-generation')
  const firstPersonX = await scene.getAttribute('data-player-x-mm')
  const firstPersonY = await scene.getAttribute('data-player-y-mm')
  await page.getByRole('button', { name: 'Third-person view' }).click()
  await expect(scene).toHaveAttribute('data-walk-view', 'third-person')
  await expect(scene).toHaveAttribute('data-player-x-mm', firstPersonX!)
  await expect(scene).toHaveAttribute('data-player-y-mm', firstPersonY!)
  await expect(scene).toHaveAttribute('data-renderer-generation', rendererGeneration!)
  await page.getByRole('button', { name: 'First-person view' }).click()
  await expect(scene).toHaveAttribute('data-walk-view', 'first-person')

  const beforeMove = `${await scene.getAttribute('data-player-x-mm')},${await scene.getAttribute('data-player-y-mm')}`
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(420)
  await page.keyboard.up('ArrowUp')
  await expect.poll(async () => `${await scene.getAttribute('data-player-x-mm')},${await scene.getAttribute('data-player-y-mm')}`).not.toBe(beforeMove)
  await page.keyboard.press('f')
  await expect(scene).toHaveAttribute('data-player-grounded', 'true')

  await page.evaluate(() => {
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Space') return
      document.documentElement.dataset.walkSpaceKey = event.key
      document.documentElement.dataset.walkSpacePrevented = String(event.defaultPrevented)
    }, { once: true })
  })
  await page.keyboard.down('Space')
  await expect(page.locator('html')).toHaveAttribute('data-walk-space-key', ' ')
  await expect(page.locator('html')).toHaveAttribute('data-walk-space-prevented', 'true')
  await page.waitForTimeout(350)
  expect(Number(await scene.getAttribute('data-player-elevation-mm'))).toBeGreaterThan(0)
  await page.keyboard.up('Space')
  expect(pageErrors).toEqual([])
})

test('shares live service state across 2D, 3D, and first-person views', async ({ page }) => {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  await openApp(page)
  await page.getByRole('button', { name: /Simulate/i }).click()
  await page.getByRole('button', { name: /Run 60-minute service/i }).click()
  await page.getByRole('button', { name: 'Pause' }).click()
  await page.getByLabel(/Simulation time/i).fill('600')
  await page.getByRole('button', { name: '3D Overview' }).click()
  const scene = page.getByTestId('simulation-3d-scene')
  await expect(scene).toHaveAttribute('data-view', 'overview-3d')
  await expect(scene).toHaveAttribute('data-staff-count', '5')
  await expect(scene.locator('canvas')).toBeVisible()
  await expect(page.getByLabel(/Live order tickets/i)).toBeVisible()
  const staffAtTenMinutes = await scene.getAttribute('data-staff-positions')

  await page.getByLabel(/Simulation time/i).fill('900')
  await expect(scene).not.toHaveAttribute('data-staff-positions', staffAtTenMinutes ?? '')
  const statusAtFifteenMinutes = await page.getByLabel(/Live service status/i).textContent()
  await page.getByRole('button', { name: 'Walk Kitchen' }).click()
  await expect(scene).toHaveAttribute('data-view', 'walk')
  await expect(page.getByRole('button', { name: /Exit walk mode/i })).toBeVisible()
  await expect(page.getByLabel(/Walk kitchen controls/i)).toContainText('WASD · Up/Down')
  await scene.locator('canvas').click()
  await expect(scene).toHaveAttribute('data-player-position', /\d+,\d+/)
  const firstPersonPosition = await scene.getAttribute('data-player-position')
  await page.getByRole('button', { name: 'Third-person view' }).click()
  await expect(scene).toHaveAttribute('data-walk-view', 'third-person')
  await expect(scene).toHaveAttribute('data-player-position', firstPersonPosition!)
  await page.getByRole('button', { name: 'First-person view' }).click()
  await expect(scene).toHaveAttribute('data-walk-view', 'first-person')
  const positionBeforeWalking = await scene.getAttribute('data-player-position')
  await page.keyboard.down('w')
  await page.waitForTimeout(450)
  await page.keyboard.up('w')
  await expect(scene).not.toHaveAttribute('data-player-position', positionBeforeWalking ?? '')
  await page.keyboard.press('Space')
  await page.keyboard.press('Escape')
  await expect(page.getByLabel(/Walk kitchen controls/i)).toBeVisible()
  await page.getByRole('button', { name: /Exit walk mode/i }).click()
  await expect(scene).toHaveAttribute('data-view', 'overview-3d')

  await scene.locator('canvas').evaluate((node) => node.dispatchEvent(new Event('webglcontextlost', { bubbles: false, cancelable: true })))
  await expect(page.getByText('Live 3D rendering paused', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Restart live 3D/i }).click()
  await expect(scene.locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: '2D Operations' }).click()
  await expect(page.getByLabel(/Simulation time/i)).toHaveValue('900')
  expect(await page.getByLabel(/Live service status/i).textContent()).toBe(statusAtFifteenMinutes)
  expect(pageErrors).toEqual([])
  expect(consoleErrors.filter((message) => !message.includes('THREE.WebGLRenderer: Context Lost'))).toEqual([])
})
