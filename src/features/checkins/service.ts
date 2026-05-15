import type { RecordModel } from 'pocketbase'
import { pb, getPocketBaseUrl } from '../../services/pocketbase'
import type {
  CheckinType,
  KRCheckin,
  KRDerived,
  StatusSignal,
} from '../../models'

/**
 * Map a raw PB record into the FE-shaped KRCheckin.
 */
export function checkinFromRecord(r: RecordModel): KRCheckin {
  return {
    id: r.id,
    keyResultId: String(r.key_result ?? ''),
    checkinDate: String(r.checkin_date ?? '').slice(0, 10),
    checkinType: (r.checkin_type as CheckinType) ?? 'weekly',
    currentValue: numOrNull(r.current_value),
    progressPercent: numOrNull(r.progress_percent),
    isCompleted: typeof r.is_completed === 'boolean' ? r.is_completed : undefined,
    confidence: Number(r.confidence ?? 0),
    statusSignal: (r.status_signal as StatusSignal) ?? 'on_track',
    progressNote: String(r.progress_note ?? ''),
    blockersNote: r.blockers_note ? String(r.blockers_note) : '',
    nextFocus: r.next_focus ? String(r.next_focus) : '',
    authorId: String(r.author ?? ''),
    created: r.created ? String(r.created) : undefined,
    updated: r.updated ? String(r.updated) : undefined,
  }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function listCheckinsForKR(keyResultId: string): Promise<KRCheckin[]> {
  const rows = await pb.collection('kr_checkins').getFullList({
    filter: `key_result="${keyResultId}"`,
    sort: '-checkin_date,-created',
    batch: 200,
    requestKey: `checkins_kr_${keyResultId}_${Date.now()}`,
  })
  return rows.map(checkinFromRecord)
}

export type CheckinDraft = {
  key_result: string
  checkin_date: string
  checkin_type: CheckinType
  confidence: number
  status_signal?: StatusSignal
  progress_note: string
  blockers_note?: string
  next_focus?: string
  current_value?: number | null
  progress_percent?: number | null
  is_completed?: boolean
  author: string
}

export async function createCheckin(draft: CheckinDraft): Promise<KRCheckin> {
  const payload = stripUndefined({
    ...draft,
    status_signal: draft.status_signal ?? deriveStatusFromConfidence(draft.confidence),
  })
  const rec = await pb.collection('kr_checkins').create(payload)
  return checkinFromRecord(rec)
}

export async function updateCheckin(id: string, patch: Partial<CheckinDraft>): Promise<KRCheckin> {
  const payload = stripUndefined(patch)
  const rec = await pb.collection('kr_checkins').update(id, payload)
  return checkinFromRecord(rec)
}

export async function deleteCheckin(id: string): Promise<void> {
  await pb.collection('kr_checkins').delete(id)
}

export function deriveStatusFromConfidence(c: number): StatusSignal {
  if (c >= 7) return 'on_track'
  if (c >= 4) return 'at_risk'
  return 'off_track'
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue
    out[k] = v
  }
  return out
}

/** Fetch derived fields from PB hook endpoint; returns null on failure. */
export async function fetchKRDerived(keyResultId: string): Promise<KRDerived | null> {
  try {
    const base = getPocketBaseUrl().replace(/\/+$/, '')
    const res = await fetch(`${base}/api/goalops/key_results/${encodeURIComponent(keyResultId)}/derived`)
    if (!res.ok) return null
    return (await res.json()) as KRDerived
  } catch {
    return null
  }
}
