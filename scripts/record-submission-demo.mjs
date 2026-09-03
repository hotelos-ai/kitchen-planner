/* global process, setTimeout, localStorage, document, window, console */
import { chromium } from 'playwright'
import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const APP_URL = process.env.DEMO_URL ?? 'https://planner.kitchen.hotelos.ai/?submission-demo=1'
const OUTPUT_PATH = resolve(process.env.DEMO_OUTPUT ?? 'artifacts/demo/calmkitchen-webmcp-demo.webm')
const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds))

await mkdir(dirname(OUTPUT_PATH), { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  recordVideo: { dir: dirname(OUTPUT_PATH), size: { width: 1440, height: 900 } },
})
const page = await context.newPage()
await page.addInitScript(() => {
  localStorage.clear()
  const registered = {}
  document.modelContext = {
    registerTool(tool) {
      registered[tool.name] = tool
      return Promise.resolve()
    },
  }
  window.__submissionDemoTools = registered
})

const caption = async (text, kicker = 'CALMKITCHEN × WEBMCP') => {
  await page.evaluate(({ text, kicker }) => {
    let overlay = document.querySelector('#submission-demo-caption')
    if (!overlay) {
      overlay = document.createElement('aside')
      overlay.id = 'submission-demo-caption'
      overlay.style.cssText = [
        'position:fixed', 'z-index:100000', 'left:28px', 'bottom:28px', 'width:min(620px,calc(100vw - 56px))',
        'padding:14px 18px', 'border:1px solid rgba(255,255,255,.22)', 'border-radius:14px',
        'background:rgba(20,31,25,.92)', 'box-shadow:0 18px 60px rgba(0,0,0,.28)', 'color:#fbfaf5',
        'font:500 20px/1.35 system-ui,sans-serif', 'letter-spacing:-.01em', 'pointer-events:none',
      ].join(';')
      document.body.append(overlay)
    }
    overlay.innerHTML = `<small style="display:block;margin-bottom:5px;color:#d5f36b;font:700 11px/1.2 system-ui,sans-serif;letter-spacing:.12em">${kicker}</small><span></span>`
    overlay.querySelector('span').textContent = text
  }, { text, kicker })
}

const call = async (name, input) => page.evaluate(async ([toolName, toolInput]) => {
  const tool = window.__submissionDemoTools?.[toolName]
  if (!tool) throw new Error(`WebMCP tool not registered: ${toolName}`)
  const result = await tool.execute(toolInput)
  return result?.structuredContent ?? result
}, [name, input])

let captureFailure
try {
  await page.goto(APP_URL, { waitUntil: 'networkidle' })
  await caption('Design the space. Fit it out. Pressure-test service before anything is built.')
  await pause(4500)

  await page.getByRole('button', { name: /Start designing.*simple starter kitchen/i }).click()
  await page.getByRole('heading', { name: /CalmKitchen Designer/i }).waitFor()
  await page.getByRole('button', { name: '2 Fit-out' }).click()
  await caption('One live professional canvas for people and AI agents.')
  await pause(4000)

  await page.waitForFunction(() => Object.keys(window.__submissionDemoTools ?? {}).length === 26)
  await page.getByRole('button', { name: 'Use your AI agent' }).click()
  await page.getByText('Agent tools active').waitFor()
  await caption('The page exposes 26 typed WebMCP tools—not screenshot automation.', 'DISCOVER')
  await call('get_workspace_guide', {})
  const layout = await call('get_layout', { view: 'summary' })
  await pause(6500)
  await page.getByRole('button', { name: 'Close AI tools' }).click()

  const baselineVariantId = layout.activeVariantId
  await caption('Preview validates the complete operation batch without mutating the project.', 'PREVIEW')
  const preview = await call('preview_layout_changes', {
    expectedRevision: layout.revision,
    intent: 'Clear the prep aisle in a candidate layout',
    operations: [
      { type: 'create_layout', variantId: 'agent-aisle-fix', parentVariantId: baselineVariantId, name: 'Agent aisle fix', equipmentMode: 'duplicate' },
      { type: 'nudge_components', variantId: 'agent-aisle-fix', componentIds: ['working-table'], delta: { xMm: -300, yMm: 0 } },
      { type: 'activate_layout', variantId: 'agent-aisle-fix' },
    ],
  })
  if (!preview.ok) throw new Error(`Preview failed: ${preview.code} ${preview.message}`)
  await pause(4500)

  await caption('Apply commits one revision, one undo step, and an agent-authored intent.', 'APPLY')
  const applied = await call('apply_layout_changes', { previewToken: preview.previewToken })
  if (!applied.ok) throw new Error(`Apply failed: ${applied.code} ${applied.message}`)
  await call('select_components', { componentIds: ['working-table'], mode: 'replace', reveal: 'plan' })
  await call('set_app_view', { panels: { catalog: false, inspector: true, revisions: true } })
  await page.getByText('Clear the prep aisle in a candidate layout', { exact: true }).waitFor()
  await pause(7000)

  await call('set_app_view', { panels: { revisions: false, inspector: true } })
  await caption('Stable component IDs connect the same selection across 2D and 3D.', 'ONE SHARED CANVAS')
  await call('focus_camera', { target: 'component', componentId: 'working-table', cameraMode: 'perspective' })
  await call('select_components', { componentIds: ['working-table'], mode: 'replace', reveal: 'both' })
  await page.locator('[data-app="calmkitchen-designer"]').waitFor()
  await pause(9000)

  await caption('A deterministic dinner-peak run drives both the visible playback and agent evidence.', 'SIMULATE')
  const simulation = await call('run_simulation', {
    variantId: 'agent-aisle-fix', scenarioId: 'dinner-peak', seed: 20260831,
    outputMode: 'metrics-only', playback: 'play', navigateTo: true,
  })
  if (!simulation.ok) throw new Error(`Simulation failed: ${simulation.code} ${simulation.message}`)
  await page.getByRole('button', { name: 'Pause' }).waitFor()
  await pause(9000)

  await caption('Compare both saved layouts under the same scenario and seed.', 'COMPARE')
  const comparison = await call('compare_layouts', {
    baselineVariantId, candidateVariantId: 'agent-aisle-fix', scenarioId: 'dinner-peak', openOverlay: true,
  })
  if (!comparison.ok) throw new Error(`Compare failed: ${comparison.code} ${comparison.message}`)
  await pause(8500)

  await caption('Share a scoped workspace link and a self-contained evidence report.', 'HAND OFF')
  await call('share_results', {
    include: ['report', 'workspace-link'], variantIds: ['agent-aisle-fix'], scenarioId: 'dinner-peak',
    download: false, returnContents: false,
  })
  await page.getByRole('button', { name: 'Use your AI agent' }).click()
  await pause(7000)

  await caption('Visible. Revision-guarded. Reversible. Built with WebMCP.', 'planner.kitchen.hotelos.ai')
  await pause(6000)
} catch (error) {
  captureFailure = error
}

const video = page.video()
await context.close()
await browser.close()
if (!video) throw new Error('Playwright did not create a recording.')
const rawPath = await video.path()
await copyFile(rawPath, OUTPUT_PATH)
await writeFile(`${OUTPUT_PATH}.source.txt`, `${APP_URL}\n`, 'utf8')
if (captureFailure) throw captureFailure
console.log(OUTPUT_PATH)
