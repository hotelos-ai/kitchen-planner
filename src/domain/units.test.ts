import { describe, expect, it } from 'vitest'
import { formatLength, parseLength } from './units'

describe('length units', () => {
  it.each([
    ['mm', '700 mm'],
    ['cm', '70 cm'],
    ['in', '27.56 in'],
    ['ft', `2' 3.56"`],
  ] as const)('formats 700 millimetres as %s', (unit, expected) => {
    expect(formatLength(700, unit)).toBe(expected)
  })

  it('round-trips imperial display without changing canonical millimetres', () => {
    expect(parseLength(formatLength(1200, 'in'), 'in')).toBeCloseTo(1200, 0)
    expect(parseLength(`3' 11.24"`, 'ft')).toBeCloseTo(1200, 0)
  })

  it('rejects non-numeric input', () => {
    expect(() => parseLength('wide', 'mm')).toThrow(/numeric length/i)
  })
})
