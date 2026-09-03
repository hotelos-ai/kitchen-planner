import { describe, expect, it } from 'vitest'
import { MAX_TOOL_RESULT_BYTES, toWebMcpToolResult } from './tool-result'

describe('WebMCP tool result envelope', () => {
  it('provides equivalent structured and parseable text content', () => {
    const payload = { ok: true, revision: 7, values: ['a', 'b'] }
    const result = toWebMcpToolResult(payload)

    expect(result).toEqual({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
      structuredContent: payload,
      isError: false,
    })
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent)
  })

  it('sets isError for structured failures', () => {
    const payload = { ok: false, code: 'invalid-input', message: 'Bad input.' }
    const result = toWebMcpToolResult(payload)

    expect(result.isError).toBe(true)
    expect(JSON.parse(result.content[0].text)).toEqual(payload)
  })

  it('accepts a payload at the byte limit and replaces a larger one with a bounded failure', () => {
    const atLimit = 'x'.repeat(MAX_TOOL_RESULT_BYTES - 2)
    const accepted = toWebMcpToolResult(atLimit)
    expect(new TextEncoder().encode(accepted.content[0].text)).toHaveLength(MAX_TOOL_RESULT_BYTES)
    expect(accepted.isError).toBe(false)

    const tooLarge = toWebMcpToolResult(`${atLimit}x`)
    expect(tooLarge.isError).toBe(true)
    expect(tooLarge.structuredContent).toMatchObject({
      ok: false,
      code: 'result-too-large',
      maxBytes: MAX_TOOL_RESULT_BYTES,
      actualBytes: MAX_TOOL_RESULT_BYTES + 1,
    })
    expect(new TextEncoder().encode(tooLarge.content[0].text).byteLength).toBeLessThan(MAX_TOOL_RESULT_BYTES)
    expect(JSON.parse(tooLarge.content[0].text)).toEqual(tooLarge.structuredContent)
  })

  it('returns a structured error for values JSON cannot serialize', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular
    const result = toWebMcpToolResult(circular)

    expect(result.isError).toBe(true)
    expect(result.structuredContent).toMatchObject({ ok: false, code: 'result-not-serializable' })
    expect(() => JSON.parse(result.content[0].text)).not.toThrow()
  })
})
