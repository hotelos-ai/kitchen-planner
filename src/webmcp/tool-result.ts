export const MAX_TOOL_RESULT_BYTES = 262_144

export type WebMcpTextContent = {
  type: 'text'
  text: string
}

export type WebMcpToolResult = {
  content: [WebMcpTextContent]
  structuredContent: unknown
  isError: boolean
}

type FailurePayload = {
  ok: false
  code: 'result-too-large' | 'result-not-serializable'
  message: string
  maxBytes: number
  actualBytes?: number
  revision?: number
}

const revisionOf = (payload: unknown): number | undefined => {
  if (payload === null || typeof payload !== 'object' || !('revision' in payload)) return undefined
  const revision = (payload as { revision?: unknown }).revision
  return typeof revision === 'number' && Number.isFinite(revision) ? revision : undefined
}

const serializedByteLength = (value: string): number => new TextEncoder().encode(value).byteLength

const failureResult = (payload: FailurePayload): WebMcpToolResult => {
  const text = JSON.stringify(payload)
  return {
    content: [{ type: 'text', text }],
    structuredContent: payload,
    isError: true,
  }
}

/**
 * Converts an internal tool payload into the interoperable MCP result shape.
 * The textual and structured representations intentionally contain the same
 * payload so clients can use either without losing error information.
 */
export function toWebMcpToolResult(payload: unknown): WebMcpToolResult {
  let text: string | undefined
  try {
    text = JSON.stringify(payload)
  } catch {
    return failureResult({
      ok: false,
      code: 'result-not-serializable',
      message: 'The tool result could not be serialized as JSON.',
      maxBytes: MAX_TOOL_RESULT_BYTES,
      ...(revisionOf(payload) === undefined ? {} : { revision: revisionOf(payload) }),
    })
  }

  if (text === undefined) {
    return failureResult({
      ok: false,
      code: 'result-not-serializable',
      message: 'The tool result did not contain a JSON-serializable value.',
      maxBytes: MAX_TOOL_RESULT_BYTES,
      ...(revisionOf(payload) === undefined ? {} : { revision: revisionOf(payload) }),
    })
  }

  const actualBytes = serializedByteLength(text)
  if (actualBytes > MAX_TOOL_RESULT_BYTES) {
    return failureResult({
      ok: false,
      code: 'result-too-large',
      message: `The serialized tool result exceeds the ${MAX_TOOL_RESULT_BYTES}-byte limit. Request a narrower view or filtered result.`,
      maxBytes: MAX_TOOL_RESULT_BYTES,
      actualBytes,
      ...(revisionOf(payload) === undefined ? {} : { revision: revisionOf(payload) }),
    })
  }

  const isError = payload !== null
    && typeof payload === 'object'
    && 'ok' in payload
    && (payload as { ok?: unknown }).ok === false

  return {
    content: [{ type: 'text', text }],
    structuredContent: payload,
    isError,
  }
}
