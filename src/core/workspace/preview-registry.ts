export const DEFAULT_PREVIEW_TTL_MS = 600_000

export type PreviewExpectation<TKind extends string> = {
  kind: TKind
  documentId: string
  revision: number
}

export type PreviewBinding<TKind extends string, TOperation, TCandidate> = PreviewExpectation<TKind> & {
  normalizedOperations: readonly TOperation[]
  candidate: TCandidate
}

export type PreviewSnapshot<TKind extends string, TOperation, TCandidate> = PreviewBinding<TKind, TOperation, TCandidate> & {
  issuedAt: number
  expiresAt: number
}

export type PreviewRegistryErrorCode =
  | 'invalid-preview-token'
  | 'expired-preview-token'
  | 'used-preview-token'
  | 'preview-kind-mismatch'
  | 'preview-document-mismatch'
  | 'preview-revision-changed'

export type PreviewRegistryResult<TKind extends string, TOperation, TCandidate> =
  | { ok: true; preview: PreviewSnapshot<TKind, TOperation, TCandidate> }
  | { ok: false; code: PreviewRegistryErrorCode; message: string }

export type PreviewRegistryOptions = {
  now?: () => number
  createToken?: () => string
  ttlMs?: number
}

type StoredPreview<TKind extends string, TOperation, TCandidate> = {
  preview: PreviewSnapshot<TKind, TOperation, TCandidate>
  used: boolean
}

const createCryptographicToken = () => {
  if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
    throw new Error('Cryptographic preview tokens are unavailable in this environment.')
  }
  return globalThis.crypto.randomUUID()
}

const clone = <T,>(value: T): T => structuredClone(value)

export function createPreviewRegistry<TKind extends string, TOperation, TCandidate>(options: PreviewRegistryOptions = {}) {
  const now = options.now ?? Date.now
  const createToken = options.createToken ?? createCryptographicToken
  const ttlMs = options.ttlMs ?? DEFAULT_PREVIEW_TTL_MS
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('Preview token TTL must be a positive finite duration.')

  const entries = new Map<string, StoredPreview<TKind, TOperation, TCandidate>>()
  const issuedTokens = new Set<string>()

  const inspect = (
    token: string,
    expected: PreviewExpectation<TKind>,
  ): PreviewRegistryResult<TKind, TOperation, TCandidate> => {
    const entry = entries.get(token)
    if (!entry) return { ok: false, code: 'invalid-preview-token', message: 'Preview token is invalid.' }
    if (entry.used) return { ok: false, code: 'used-preview-token', message: 'Preview token has already been used.' }
    if (now() >= entry.preview.expiresAt) return { ok: false, code: 'expired-preview-token', message: 'Preview token has expired.' }
    if (entry.preview.kind !== expected.kind) return {
      ok: false,
      code: 'preview-kind-mismatch',
      message: `Preview kind ${entry.preview.kind} does not match ${expected.kind}.`,
    }
    if (entry.preview.documentId !== expected.documentId) return {
      ok: false,
      code: 'preview-document-mismatch',
      message: 'Preview token belongs to a different document.',
    }
    if (entry.preview.revision !== expected.revision) return {
      ok: false,
      code: 'preview-revision-changed',
      message: `Preview revision ${entry.preview.revision} no longer matches ${expected.revision}.`,
    }
    return { ok: true, preview: clone(entry.preview) }
  }

  return {
    issue(binding: PreviewBinding<TKind, TOperation, TCandidate>): string {
      const token = createToken()
      if (!token || issuedTokens.has(token)) throw new Error('Preview token generator returned an empty or duplicate token.')
      issuedTokens.add(token)
      const issuedAt = now()
      entries.set(token, {
        used: false,
        preview: {
          ...binding,
          normalizedOperations: clone(binding.normalizedOperations),
          candidate: clone(binding.candidate),
          issuedAt,
          expiresAt: issuedAt + ttlMs,
        },
      })
      return token
    },

    peek(token: string, expected: PreviewExpectation<TKind>): PreviewRegistryResult<TKind, TOperation, TCandidate> {
      return inspect(token, expected)
    },

    consume(token: string, expected: PreviewExpectation<TKind>): PreviewRegistryResult<TKind, TOperation, TCandidate> {
      const result = inspect(token, expected)
      if (!result.ok) return result
      entries.get(token)!.used = true
      return result
    },

    invalidateDocument(documentId: string): number {
      let invalidated = 0
      for (const [token, entry] of entries) {
        if (entry.preview.documentId !== documentId) continue
        entries.delete(token)
        invalidated += 1
      }
      return invalidated
    },

    invalidateAll(): number {
      const invalidated = entries.size
      entries.clear()
      return invalidated
    },
  }
}
