import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('edits, simulates, compares, exports, and restores Manta Raja', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Manta Raja Kitchen Lab/i })).toBeVisible()

  await page.getByRole('button', { name: /Select Tandoor, 700 mm by 700 mm/i }).click()
  await page.getByLabel(/Lock dimensions/i).uncheck()
  await page.getByLabel(/^Width \(mm\)$/i).fill('750')
  await page.getByLabel(/^Width \(mm\)$/i).press('Tab')
  await page.getByLabel(/Display units/i).selectOption('ft')
  await page.getByLabel(/Display units/i).selectOption('mm')
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

  await page.getByRole('button', { name: /New variant/i }).click()
  await expect(page.getByLabel(/Active layout variant/i)).toHaveValue(/variant-/)
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

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Export project/i }).click()
  const download = await downloadPromise
  const exportedPath = await download.path()
  expect(exportedPath).toBeTruthy()
  await page.getByLabel(/Import project JSON/i).setInputFiles(exportedPath!)
  await expect(page.getByRole('status')).toContainText(/Imported/i)
})

test('keeps the full simulation readable at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
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

test('keeps every 3D control usable and recovers a lost WebGL context', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(page.getByTestId('kitchen-scene').locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Top', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Top', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Perspective', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Perspective', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Fit room', exact: true }).click()
  await page.getByRole('button', { name: 'Clearances', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Clearances', exact: true })).toHaveAttribute('aria-pressed', 'true')
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
