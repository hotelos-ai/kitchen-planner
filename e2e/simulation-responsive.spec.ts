import { expect, test, type Page } from '@playwright/test'

const SCREENSHOT_VIEWPORT = { width: 1909, height: 792 }

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

test.describe('Simulation responsive layout', () => {
  test.use({ viewport: SCREENSHOT_VIEWPORT })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.clear())
  })

  test('keeps the expanded Scenario rail usable at 1909 × 792', async ({ page }) => {
    await openSimulationWorkspace(page)

    const workspace = page.locator('.simulation-workspace.three-panel')
    const scenario = page.locator('.simulation-scenario-panel')
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

    const overflow = await scenario.evaluate((element) => ({
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
