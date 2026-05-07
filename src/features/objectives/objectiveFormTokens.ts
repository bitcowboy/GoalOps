import { normalizeObjectiveStatusKey } from '@/features/objectives/objectiveDetailUtils'

/** Shared Tailwind classes for structured objective forms (create / edit). */
export const objectiveFormInputCls =
  'w-full rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2.5 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] placeholder:text-[var(--goalops-text-subtle)] focus:bg-[var(--goalops-surface)] focus:ring-2 disabled:opacity-60'

export const objectiveFormSelectCls =
  'w-full min-w-[120px] rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2.5 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] focus:bg-[var(--goalops-surface)] focus:ring-2 disabled:opacity-60'

export const objectiveFormLabelCls = 'block text-sm font-medium text-[var(--goalops-text)]'

export function objectiveRecordStatusTone(
  statusKey: string,
): 'success' | 'warning' | 'neutral' {
  const k = normalizeObjectiveStatusKey(statusKey)
  if (k === 'in_progress' || k === 'in_review') return 'success'
  if (k === 'paused') return 'warning'
  if (k === 'done' || k === 'cancelled') return 'neutral'
  return 'neutral'
}
