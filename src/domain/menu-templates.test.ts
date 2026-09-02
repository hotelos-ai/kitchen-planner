import { describe, expect, it } from 'vitest'
import { parseMenuText, DEFAULT_GENERATED_MENU } from './menu-templates'

describe('menu templates', () => {
  it('parses pasted menu lines into estimated items', () => {
    const items = parseMenuText('Grilled reef fish\nChicken curry\n')
    expect(items).toHaveLength(2)
    expect(items[0].name).toBe('Grilled reef fish')
    expect(items[0].source).toBe('imported')
    expect(items[0].steps.length).toBeGreaterThan(0)
  })

  it('ships a generated estimate library with routes and times', () => {
    expect(DEFAULT_GENERATED_MENU.length).toBeGreaterThanOrEqual(4)
    expect(DEFAULT_GENERATED_MENU.every((item) => item.source === 'template-estimate')).toBe(true)
  })
})
