import { describe, expect, it } from 'vitest'
import { detectModelContext } from './model-context'

const surfaceWithRegisterTool = () => ({ registerTool: () => Promise.resolve(undefined) })

describe('detectModelContext', () => {
  it('reports unavailable when neither surface exposes registerTool', () => {
    const detection = detectModelContext({ document: {}, navigator: {}, isTopLevel: true, isSecureContext: true })
    expect(detection).toMatchObject({ available: false })
    if (!detection.available) expect(detection.reason).toMatch(/modelContext/)
  })

  it('prefers the document surface over the deprecated navigator surface', () => {
    const detection = detectModelContext({
      document: { modelContext: surfaceWithRegisterTool() },
      navigator: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: true,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: true, surface: 'document' })
  })

  it('falls back to the navigator surface when document is missing', () => {
    const detection = detectModelContext({
      document: {},
      navigator: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: true,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: true, surface: 'navigator' })
  })

  it('refuses registration inside iframes', () => {
    const detection = detectModelContext({
      document: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: false,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: false })
    if (!detection.available) expect(detection.reason).toMatch(/iframe/i)
  })

  it('refuses registration in insecure contexts', () => {
    const detection = detectModelContext({
      document: { modelContext: surfaceWithRegisterTool() },
      isTopLevel: true,
      isSecureContext: false,
    })
    expect(detection).toMatchObject({ available: false })
    if (!detection.available) expect(detection.reason).toMatch(/secure/i)
  })

  it('ignores non-function modelContext surfaces', () => {
    const detection = detectModelContext({
      document: { modelContext: { registerTool: 'not a function' } },
      navigator: { modelContext: null },
      isTopLevel: true,
      isSecureContext: true,
    })
    expect(detection).toMatchObject({ available: false })
  })
})
