import { expect, test, type Page } from '@playwright/test'

const SCREENSHOT_VIEWPORT = { width: 1909, height: 792 }
const RESPONSIVE_VIEWPORTS = [
  { width: 1440, height: 650 },
  { width: 1024, height: 768 },
  { width: 760, height: 800 },
] as const

type ElementBox = NonNullable<Awaited<ReturnType<ReturnType<Page['locator']>['boundingBox']>>>

async function openSimulationWorkspace(page: Page) {
  await page.goto('/')
  const starter = page.getByRole('button', { name: /Simple starter kitchen/i })
  try {
    await starter.waitFor({ state: 'visible', timeout: 3000 })
    await starter.click()
  } catch {
    // A reused local session may already have an open workspace.
  }
  await expect(page.getByRole('heading', { name: /CalmKitchen Designer/i })).toBeVisible()
  await page.getByRole('button', { name: '3 Simulate' }).click()
  await expect(page.locator('.simulation-workspace.three-panel')).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const surfaces = [
    ['document', page.locator('html')],
    ['Simulation workspace', page.locator('.simulation-workspace.three-panel')],
    ['Simulation toolbar', page.locator('.simulation-toolbar')],
  ] as const
  for (const [name, surface] of surfaces) {
    const size = await surface.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(size.scrollWidth, `${name} should not overflow horizontally`).toBeLessThanOrEqual(size.clientWidth + 1)
  }
}

function expectNoOverlap(left: ElementBox, right: ElementBox, label: string) {
  const overlapX = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)
  const overlapY = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)
  expect(overlapX > 1 && overlapY > 1, `${label} should not overlap`).toBe(false)
}

async function expectScrollReachable(locator: ReturnType<Page['locator']>) {
  await locator.scrollIntoViewIfNeeded()
  await expect(locator).toBeVisible()
}

test.describe('Simulation responsive layout', () => {
  test.use({ viewport: SCREENSHOT_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
  })

  test('keeps the expanded Scenario rail usable at 1909 × 792', async ({ page }) => {
    await openSimulationWorkspace(page)

    const workspace = page.locator('.simulation-workspace.three-panel')
    const scenario = page.locator('.simulation-scenario-panel')
    const scenarioContent = page.locator('#simulation-scenario-content')
    const scenarioPicker = page.getByLabel('Active scenario')
    const covers = scenario.getByLabel('Covers')
    const duration = scenario.getByLabel('Duration (minutes)')

    await expect(workspace).not.toHaveClass(/scenario-collapsed/)
    await expect(scenario).toBeVisible()
    await expect(scenarioPicker).toBeVisible()
    await expect(covers).toBeVisible()
    await expect(duration).toBeVisible()

    const scenarioBox = await scenario.boundingBox()
    const pickerBox = await scenarioPicker.boundingBox()
    const coversBox = await covers.boundingBox()
    const durationBox = await duration.boundingBox()

    expect(scenarioBox).not.toBeNull()
    expect(scenarioBox!.width).toBeGreaterThanOrEqual(300)
    expect(scenarioBox!.x).toBeGreaterThanOrEqual(0)
    expect(scenarioBox!.x + scenarioBox!.width).toBeLessThanOrEqual(SCREENSHOT_VIEWPORT.width)
    expect(pickerBox!.width).toBeGreaterThan(250)
    expect(coversBox!.width).toBeGreaterThan(100)
    expect(durationBox!.width).toBeGreaterThan(100)

    const overflow = await scenarioContent.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }))
    expect(overflow.overflowY).toBe('auto')
    expect(overflow.scrollHeight).toBeGreaterThan(overflow.clientHeight)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(SCREENSHOT_VIEWPORT.width)
  })

  test('applies the intentional collapsed Scenario rail geometry', async ({ page }) => {
    await openSimulationWorkspace(page)

    const workspace = page.locator('.simulation-workspace.three-panel')
    const scenario = page.locator('.simulation-scenario-panel')
    const simulationMain = page.locator('.simulation-main')
    const expandedMainBox = await simulationMain.boundingBox()
    await scenario.evaluate((element) => element.scrollTo({ top: element.scrollHeight }))

    const collapse = page.getByRole('button', { name: 'Collapse scenario panel', exact: true })
    await expect(collapse).toBeVisible()
    await expect(collapse).toHaveAttribute('aria-expanded', 'true')
    await expect(collapse).toHaveAttribute('aria-controls', 'simulation-scenario-content')
    await collapse.click()

    await expect(workspace).toHaveClass(/scenario-collapsed/)
    await expect.poll(async () => (await scenario.boundingBox())?.width).toBe(52)
    const expand = page.getByRole('button', { name: 'Expand scenario panel', exact: true })
    await expect(expand).toBeVisible()
    await expect(expand).toHaveAttribute('aria-expanded', 'false')
    await expect(expand).toHaveAttribute('aria-controls', 'simulation-scenario-content')
    await expect(page.locator('#simulation-scenario-content')).toBeHidden()
    expect(await scenario.evaluate((element) => getComputedStyle(element).overflowY)).toBe('hidden')

    const collapsedMainBox = await simulationMain.boundingBox()
    expect(expandedMainBox).not.toBeNull()
    expect(collapsedMainBox).not.toBeNull()
    expect(collapsedMainBox!.x).toBeLessThan(expandedMainBox!.x)
    expect(collapsedMainBox!.width).toBeGreaterThan(expandedMainBox!.width + 250)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(SCREENSHOT_VIEWPORT.width)

    await expand.click()
    await expect(workspace).not.toHaveClass(/scenario-collapsed/)
    await expect.poll(async () => (await scenario.boundingBox())?.width).toBe(320)
    await expect(page.locator('#simulation-scenario-content')).toBeVisible()
    await expect(page.getByLabel('Active scenario')).toBeVisible()
  })
})

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test.describe(`Simulation at ${viewport.width} × ${viewport.height}`, () => {
    test.use({ viewport })

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => localStorage.clear())
    })

    test('keeps panels, controls, results, and collapse affordances usable', async ({ page }) => {
      await openSimulationWorkspace(page)

      const workspace = page.locator('.simulation-workspace.three-panel')
      const scenario = page.locator('.simulation-scenario-panel')
      const simulationMain = page.locator('.simulation-main')
      const sidebar = page.locator('.simulation-sidebar')
      const toolbar = page.locator('.simulation-toolbar')

      await expectNoHorizontalOverflow(page)
      const [scenarioBox, mainBox, sidebarBox] = await Promise.all([
        scenario.boundingBox(),
        simulationMain.boundingBox(),
        sidebar.boundingBox(),
      ])
      expect(scenarioBox).not.toBeNull()
      expect(mainBox).not.toBeNull()
      expect(sidebarBox).not.toBeNull()
      expect(scenarioBox!.height).toBeGreaterThanOrEqual(48)
      expectNoOverlap(scenarioBox!, mainBox!, 'Scenario and simulation canvas')
      expectNoOverlap(mainBox!, sidebarBox!, 'Simulation canvas and results sidebar')

      const collapse = page.getByRole('button', { name: 'Collapse scenario panel', exact: true })
      await expectScrollReachable(collapse)
      await expectScrollReachable(toolbar.getByRole('button', { name: 'Run 60-minute service', exact: true }))
      await toolbar.getByRole('button', { name: 'Run 60-minute service', exact: true }).click()

      const playback = page.locator('.playback-controls')
      const result = page.locator('.simulation-primary-summary')
      await expectScrollReachable(playback)
      await expectScrollReachable(page.getByLabel(/Simulation time/i))
      await expectScrollReachable(result)
      await expect(result).toContainText(/Orders completed/i)

      await expect(workspace).not.toHaveClass(/scenario-collapsed/)
      const collapseAfterRun = page.getByRole('button', { name: 'Collapse scenario panel', exact: true })
      await expectScrollReachable(collapseAfterRun)
      await collapseAfterRun.click()
      await expect(workspace).toHaveClass(/scenario-collapsed/)
      const expand = page.getByRole('button', { name: 'Expand scenario panel', exact: true })
      await expectScrollReachable(expand)
      await expand.click()
      await expect(workspace).not.toHaveClass(/scenario-collapsed/)
      await expectScrollReachable(page.getByRole('button', { name: 'Collapse scenario panel', exact: true }))

      await expectNoHorizontalOverflow(page)
      const [expandedScenarioBox, expandedMainBox, expandedSidebarBox] = await Promise.all([
        scenario.boundingBox(),
        simulationMain.boundingBox(),
        sidebar.boundingBox(),
      ])
      expect(expandedScenarioBox).not.toBeNull()
      expect(expandedMainBox).not.toBeNull()
      expect(expandedSidebarBox).not.toBeNull()
      expect(expandedScenarioBox!.height).toBeGreaterThanOrEqual(48)
      expectNoOverlap(expandedScenarioBox!, expandedMainBox!, 'Expanded Scenario and simulation canvas')
      expectNoOverlap(expandedMainBox!, expandedSidebarBox!, 'Expanded simulation canvas and results sidebar')
    })
  })
}
