import type { ObjectiveNextActionJson, ObjectivePhaseStep } from '@/models'

export function editorToPlainText(html: string): string {
  if (!html.includes('<')) return html
  const el = document.createElement('div')
  el.innerHTML = html
  return el.textContent?.trim() ?? ''
}

export function parseStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string')
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const v = JSON.parse(raw) as unknown
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

function isPhaseStep(x: unknown): x is ObjectivePhaseStep {
  if (!x || typeof x !== 'object') return false
  const o = x as ObjectivePhaseStep
  return typeof o.title === 'string' && typeof o.date_range === 'string'
}

export function parsePhaseTimeline(raw: unknown): ObjectivePhaseStep[] {
  let arr: unknown[] = []
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const v = JSON.parse(raw) as unknown
      arr = Array.isArray(v) ? v : []
    } catch {
      arr = []
    }
  }
  return arr.filter(isPhaseStep)
}

function isNextAction(x: unknown): x is ObjectiveNextActionJson {
  if (!x || typeof x !== 'object') return false
  const o = x as ObjectiveNextActionJson
  return typeof o.suggestion === 'string'
}

export function parseNextActions(raw: unknown): ObjectiveNextActionJson[] {
  let arr: unknown[] = []
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const v = JSON.parse(raw) as unknown
      arr = Array.isArray(v) ? v : []
    } catch {
      arr = []
    }
  }
  return arr.filter(isNextAction)
}

export function formatDotDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  return iso.replace(/-/g, '.')
}

export function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  const h = `${d.getHours()}`.padStart(2, '0')
  const min = `${d.getMinutes()}`.padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}`
}

export function objectiveStatusLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: '未开始',
    in_progress: '进行中',
    at_risk: '风险',
    done: '完成',
    cancelled: '取消',
  }
  return map[status] ?? status
}

export function taskStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '未开始',
    in_progress: '进行中',
    deliver: '交付',
    review: '验收',
    done: '完结',
  }
  return map[status] ?? status
}

export function priorityPillTone(p: string): 'high' | 'medium' | 'low' {
  if (p === 'P0' || p === 'P1') return 'high'
  if (p === 'P2') return 'medium'
  return 'low'
}

export function initialsFromName(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  const segs = t.split(/[\s·．.]+/).filter(Boolean)
  if (segs.length >= 2) {
    const a = segs[0]!.slice(0, 1)
    const b = segs[1]!.slice(0, 1)
    return (a + b).toUpperCase()
  }
  return t.slice(0, 2).toUpperCase()
}

export function calendarInclusiveDays(startIso: string | undefined, dueIso: string | undefined): number | null {
  if (!startIso || !dueIso) return null
  const s = new Date(`${startIso}T00:00:00`)
  const e = new Date(`${dueIso}T00:00:00`)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000)
  return diff >= 0 ? diff + 1 : null
}

export function remainingCalendarDays(dueIso: string | undefined): number | null {
  if (!dueIso) return null
  const due = new Date(`${dueIso}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (Number.isNaN(due.getTime())) return null
  return Math.ceil((due.getTime() - today.getTime()) / 86400000)
}

export function clampPercent(n: unknown): number {
  const x = typeof n === 'number' ? n : Number(n)
  if (Number.isNaN(x)) return 0
  return Math.min(100, Math.max(0, x))
}
