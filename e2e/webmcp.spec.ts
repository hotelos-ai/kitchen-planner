import { expect, test, type Page } from '@playwright/test'

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


type ShimmedTool = {
  name: string
  description: string
  execute: (input: unknown) => Promise<unknown>
}

type ShimWindow = Window & {
  __webmcpTools: Record<string, ShimmedTool>
}

type Envelope = {
  ok: boolean
  revision?: number
  code?: string
  documentId?: string
  coordinateSystem?: { unit?: string }
  components?: { id: string; xMm: number; yMm: number }[]
  previewToken?: string
  changedIds?: string[]
  projectJson?: string
  stepped?: boolean
}

const installWebMcpShim = () => {
  const registered: Record<string, ShimmedTool> = {}
  ;(document as Document & { modelContext?: unknown }).modelContext = {
    registerTool: (tool: ShimmedTool) => {
      registered[tool.name] = tool
      return Promise.resolve(undefined)
    },
  }
  ;(window as unknown as ShimWindow).__webmcpTools = registered
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear())
})

test('agents discover tools, edit the plan, run simulations, and export — without a reload', async ({ page }) => {
  await page.addInitScript(installWebMcpShim)
  await openApp(page)
  await expect(page.getByRole('heading', { name: /CalmKitchen Designer/i })).toBeVisible()

  await page.waitForFunction(() => Object.keys((window as unknown as ShimWindow).__webmcpTools ?? {}).length >= 11)
  const call = (name: string, input: unknown): Promise<Envelope> =>
    page.evaluate(([toolName, toolInput]: [string, unknown]) => {
      const entry = (window as unknown as ShimWindow).__webmcpTools[toolName]
      if (!entry) throw new Error(`Tool ${toolName} was not registered`)
      return Promise.resolve(entry.execute(toolInput)).then((result) => {
        if (result && typeof result === 'object' && 'structuredContent' in result) {
          return (result as { structuredContent: Envelope }).structuredContent
        }
        return result as Envelope
      })
    }, [name, input])

  await page.getByRole('button', { name: 'Use your AI agent' }).click()
  await expect(page.getByRole('dialog', { name: 'AI agent tools' })).toBeVisible()
  await expect(page.getByText('Agent tools active')).toBeVisible()

  const guide = await call('get_workspace_guide', {})
  expect(guide.ok).toBe(true)
  expect(guide.coordinateSystem?.unit).toMatch(/millimetres/i)

  const before = await call('get_layout', {})
  expect(before.ok).toBe(true)
  expect(before.revision).toBe(0)
  const tandoor = before.components?.find((component) => component.id === 'tandoor')
  expect(tandoor).toBeDefined()

  const preview = await call('preview_layout_changes', {
    expectedRevision: before.revision,
    operations: [
      { type: 'move_components', variantId: 'baseline-trace', componentIds: ['tandoor'], anchor: { xMm: (tandoor?.xMm ?? 0) + 200, yMm: tandoor?.yMm ?? 0 } },
      { type: 'update_component', variantId: 'baseline-trace', componentId: 'tandoor', patch: { notes: 'agent e2e adjustment' } },
    ],
    intent: 'E2E agent move',
  })
  expect(preview.ok).toBe(true)
  expect(preview.previewToken).toEqual(expect.any(String))
  expect(preview.changedIds).toEqual(['tandoor'])

  await page.evaluate(() => { (window as unknown as { __noReloadMarker: boolean }).__noReloadMarker = true })

  const applied = await call('apply_layout_changes', { previewToken: preview.previewToken })
  expect(applied.ok).toBe(true)
  expect(applied.revision).toBe(1)

  const after = await call('get_layout', {})
  expect(after.components?.find((component) => component.id === 'tandoor')?.xMm).toBe((tandoor?.xMm ?? 0) + 200)

  const markerPreserved = await page.evaluate(() => (window as unknown as { __noReloadMarker?: boolean }).__noReloadMarker === true)
  expect(markerPreserved).toBe(true)
  await expect(page.getByText(/Rev 1/).first()).toBeVisible()

  const simulation = await call('run_simulation', {})
  expect(simulation.ok).toBe(true)

  const exported = await call('export_project', {})
  expect(exported.ok).toBe(true)
  expect(JSON.parse(exported.projectJson ?? '{}')).toMatchObject({ schemaVersion: 4 })

  const undone = await call('step_workspace_history', { direction: 'undo' })
  expect(undone.stepped).toBe(true)
  const reverted = await call('get_layout', {})
  expect(reverted.components?.find((component) => component.id === 'tandoor')?.xMm).toBe(tandoor?.xMm)

  await expect(page.getByText(/preview_layout_changes/).first()).toBeVisible()
  await expect(page.getByText(/No agent activity yet/i)).toHaveCount(0)
})

test('browsers without WebMCP keep the full interface with setup guidance', async ({ page }) => {
  await openApp(page)
  await expect(page.getByRole('heading', { name: /CalmKitchen Designer/i })).toBeVisible()
  await page.getByRole('button', { name: 'Use your AI agent' }).click()
  await expect(page.getByRole('dialog', { name: 'AI agent tools' })).toBeVisible()
  await expect(page.getByText('Agent tools unavailable in this browser')).toBeVisible()
  await expect(page.getByText(/stays fully usable without it/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Close AI tools' })).toBeVisible()
  await page.getByRole('button', { name: 'Close AI tools' }).click()
  await expect(page.getByRole('dialog', { name: 'AI agent tools' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: /Placed/i })).toBeVisible()
})
