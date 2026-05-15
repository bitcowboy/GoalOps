import type { StatusSignal } from '../../models'

export function statusSignalLabel(s: StatusSignal): string {
  if (s === 'on_track') return 'On Track'
  if (s === 'at_risk') return 'At Risk'
  return 'Off Track'
}

export function statusSignalTone(s: StatusSignal): 'success' | 'warning' | 'danger' {
  if (s === 'on_track') return 'success'
  if (s === 'at_risk') return 'warning'
  return 'danger'
}

export function statusSignalDot(s: StatusSignal): string {
  if (s === 'on_track') return 'bg-[var(--goalops-success)]'
  if (s === 'at_risk') return 'bg-[var(--goalops-warning)]'
  return 'bg-[var(--goalops-danger)]'
}

export function krTypeLabel(t: 'metric' | 'checkbox' | 'milestone' | string): string {
  if (t === 'metric') return 'Metric'
  if (t === 'milestone') return 'Milestone'
  return 'Checkbox'
}

export function checkinTypeLabel(t: string): string {
  if (t === 'milestone') return '里程碑'
  if (t === 'adhoc') return '临时'
  return '周报'
}
