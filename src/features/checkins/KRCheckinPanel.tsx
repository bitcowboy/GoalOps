import { useCallback, useEffect, useState } from 'react'
import type { KRCheckin, KRDerived, KRType } from '../../models'
import {
  deleteCheckin,
  fetchKRDerived,
  listCheckinsForKR,
} from './service'
import { CheckinForm } from './CheckinForm'
import { CheckinTimeline } from './CheckinTimeline'

type KRForPanel = {
  id: string
  name: string
  kr_type: KRType
  owner?: string
  start_value?: number | null
  target_value?: number | null
  unit?: string
  direction?: 'increase' | 'decrease' | null
}

type Props = {
  kr: KRForPanel
  members: Array<{ id: string; name: string }>
  /** 当列表/单条变化时父组件可顺便刷新派生 */
  onChange?: (derived: KRDerived | null) => void
}

export function KRCheckinPanel({ kr, members, onChange }: Props) {
  const [checkins, setCheckins] = useState<KRCheckin[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<KRCheckin | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [list, derived] = await Promise.all([listCheckinsForKR(kr.id), fetchKRDerived(kr.id)])
      setCheckins(list)
      if (onChange) onChange(derived)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [kr.id, onChange])

  useEffect(() => {
    queueMicrotask(() => void refresh())
  }, [refresh])

  const memberNameById = members.reduce<Record<string, string>>((acc, m) => {
    acc[m.id] = m.name
    return acc
  }, {})

  async function handleDelete(c: KRCheckin) {
    const ok = window.confirm(
      `确定删除 ${c.checkinDate} 这条 check-in？\n\n该操作不可恢复。`,
    )
    if (!ok) return
    try {
      await deleteCheckin(c.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-[var(--goalops-border)] bg-slate-50/40 p-3">
      <div className="flex items-center justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
          Check-in 历史
        </h5>
        {loading ? <span className="text-xs text-[var(--goalops-text-subtle)]">加载中…</span> : null}
      </div>

      {error ? (
        <p className="text-xs text-[var(--goalops-danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {checkins ? (
        <CheckinTimeline
          checkins={checkins}
          krType={kr.kr_type}
          krDirection={kr.direction}
          memberNameById={memberNameById}
          unit={kr.unit}
          onCreate={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          onEdit={(c) => {
            setEditing(c)
            setFormOpen(true)
          }}
          onDelete={(c) => void handleDelete(c)}
        />
      ) : null}

      {formOpen ? (
        <CheckinForm
          kr={kr}
          members={members}
          existing={editing ?? undefined}
          onSuccess={async () => {
            setFormOpen(false)
            setEditing(null)
            await refresh()
          }}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
