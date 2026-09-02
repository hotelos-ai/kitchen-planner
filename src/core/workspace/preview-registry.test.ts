import { describe, expect, it } from 'vitest'
import { createPreviewRegistry } from './preview-registry'

type PreviewKind = 'layout' | 'scenario'
type Operation = { op: string; id: string }
type Candidate = { name: string; componentIds: string[] }

const expected = (overrides: Partial<{ kind: PreviewKind; documentId: string; revision: number }> = {}) => ({
  kind: 'layout' as PreviewKind,
  documentId: 'document-1',
  revision: 7,
  ...overrides,
})

describe('preview registry', () => {
  it('binds an isolated snapshot to kind, document, revision, operations, candidate, and configurable expiry', () => {
    let now = 1_000
    let sequence = 0
    const operations: Operation[] = [{ op: 'move_components', id: 'range' }]
    const candidate: Candidate = { name: 'Candidate', componentIds: ['range'] }
    const registry = createPreviewRegistry<PreviewKind, Operation, Candidate>({
      now: () => now,
      createToken: () => `token-${++sequence}`,
      ttlMs: 2_000,
    })

    const token = registry.issue({ ...expected(), normalizedOperations: operations, candidate })
    operations[0].id = 'mutated-after-issue'
    candidate.componentIds.push('mutated-after-issue')

    expect(token).toBe('token-1')
    const firstPeek = registry.peek(token, expected())
    expect(firstPeek).toEqual({
      ok: true,
      preview: {
        ...expected(),
        normalizedOperations: [{ op: 'move_components', id: 'range' }],
        candidate: { name: 'Candidate', componentIds: ['range'] },
        issuedAt: 1_000,
        expiresAt: 3_000,
      },
    })
    if (firstPeek.ok) firstPeek.preview.candidate.componentIds.push('mutated-peek')
    expect(registry.peek(token, expected())).toMatchObject({
      ok: true,
      preview: { candidate: { componentIds: ['range'] } },
    })

    now = 2_999
    expect(registry.peek(token, expected())).toMatchObject({ ok: true })
  })

  it('reports stable binding mismatch codes without consuming the token', () => {
    const registry = createPreviewRegistry<PreviewKind, Operation, Candidate>({ createToken: () => 'bound-token' })
    const token = registry.issue({
      ...expected(),
      normalizedOperations: [{ op: 'move_components', id: 'range' }],
      candidate: { name: 'Candidate', componentIds: ['range'] },
    })

    expect(registry.consume(token, expected({ kind: 'scenario' }))).toMatchObject({ ok: false, code: 'preview-kind-mismatch' })
    expect(registry.consume(token, expected({ documentId: 'document-2' }))).toMatchObject({ ok: false, code: 'preview-document-mismatch' })
    expect(registry.consume(token, expected({ revision: 8 }))).toMatchObject({ ok: false, code: 'preview-revision-changed' })
    expect(registry.peek(token, expected())).toMatchObject({ ok: true })

    expect(registry.consume(token, expected())).toMatchObject({
      ok: true,
      preview: { candidate: { name: 'Candidate' } },
    })
    expect(registry.consume(token, expected())).toEqual({
      ok: false,
      code: 'used-preview-token',
      message: 'Preview token has already been used.',
    })
    expect(registry.peek(token, expected())).toMatchObject({ ok: false, code: 'used-preview-token' })
  })

  it('distinguishes unknown and expired tokens at the exact TTL boundary', () => {
    let now = 5_000
    const registry = createPreviewRegistry<PreviewKind, Operation, Candidate>({
      now: () => now,
      createToken: () => 'expiring-token',
      ttlMs: 600_000,
    })
    const token = registry.issue({
      ...expected(),
      normalizedOperations: [],
      candidate: { name: 'Candidate', componentIds: [] },
    })

    expect(registry.peek('unknown-token', expected())).toEqual({
      ok: false,
      code: 'invalid-preview-token',
      message: 'Preview token is invalid.',
    })
    now = 605_000
    expect(registry.peek(token, expected())).toEqual({
      ok: false,
      code: 'expired-preview-token',
      message: 'Preview token has expired.',
    })
    expect(registry.consume(token, expected())).toMatchObject({ ok: false, code: 'expired-preview-token' })
  })

  it('invalidates one document or the complete registry', () => {
    let sequence = 0
    const registry = createPreviewRegistry<PreviewKind, Operation, Candidate>({ createToken: () => `token-${++sequence}` })
    const issue = (documentId: string) => registry.issue({
      ...expected({ documentId }),
      normalizedOperations: [],
      candidate: { name: documentId, componentIds: [] },
    })
    const first = issue('document-1')
    const second = issue('document-1')
    const other = issue('document-2')

    expect(registry.invalidateDocument('document-1')).toBe(2)
    expect(registry.peek(first, expected())).toMatchObject({ ok: false, code: 'invalid-preview-token' })
    expect(registry.peek(second, expected())).toMatchObject({ ok: false, code: 'invalid-preview-token' })
    expect(registry.peek(other, expected({ documentId: 'document-2' }))).toMatchObject({ ok: true })
    expect(registry.invalidateAll()).toBe(1)
    expect(registry.peek(other, expected({ documentId: 'document-2' }))).toMatchObject({ ok: false, code: 'invalid-preview-token' })
  })

  it('uses unique opaque cryptographic tokens and a ten-minute TTL by default', () => {
    const registry = createPreviewRegistry<PreviewKind, Operation, Candidate>()
    const issue = () => registry.issue({
      ...expected(),
      normalizedOperations: [],
      candidate: { name: 'Candidate', componentIds: [] },
    })
    const first = issue()
    const second = issue()

    expect(first).not.toBe(second)
    expect(first.length).toBeGreaterThanOrEqual(16)
    expect(first).not.toContain('document-1')
    expect(first).not.toContain('layout')
    const peek = registry.peek(first, expected())
    expect(peek).toMatchObject({ ok: true })
    if (peek.ok) expect(peek.preview.expiresAt - peek.preview.issuedAt).toBe(600_000)
  })
})
