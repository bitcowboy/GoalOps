/**
 * MCP tool response helpers and shared field shapes.
 */

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export function ok(data: unknown): ToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return { content: [{ type: 'text', text }] }
}

export function fail(err: unknown): ToolResult {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err)
        : String(err)
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  }
}

/** Strip `undefined` values; keep `null` so the caller can clear relations explicitly. */
export function compactRecord<T extends Record<string, unknown>>(r: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(r)) {
    if (v === undefined) continue
    out[k] = v
  }
  return out
}
