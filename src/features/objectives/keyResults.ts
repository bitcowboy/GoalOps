/**
 * Key Result（Checkbox）完成率工具。
 */

export type KeyResultCompletion = {
  completed: number
  total: number
  /** 0–100，无 KR 时为 null */
  percent: number | null
}

export function krCompletionFromFlags(isCompletedFlags: readonly boolean[]): KeyResultCompletion {
  const total = isCompletedFlags.length
  if (total === 0) {
    return { completed: 0, total: 0, percent: null }
  }
  const completed = isCompletedFlags.filter(Boolean).length
  return {
    completed,
    total,
    percent: Math.round((completed / total) * 100),
  }
}

export function krCompletionFromRows(rows: readonly { name: string; is_completed: boolean }[]): KeyResultCompletion {
  const named = rows.map((r) => r.name.trim()).filter(Boolean)
  if (named.length === 0) {
    return { completed: 0, total: 0, percent: null }
  }
  const flags = rows
    .filter((r) => r.name.trim().length > 0)
    .map((r) => Boolean(r.is_completed))
  return krCompletionFromFlags(flags)
}
