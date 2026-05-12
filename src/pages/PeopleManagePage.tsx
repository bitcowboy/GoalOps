import type { FormEvent } from 'react'
import type { RecordModel } from 'pocketbase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search, UsersRound } from 'lucide-react'
import { SectionCard, StatusPill } from '@/components'
import { pb } from '@/services/pocketbase'

const inputCls =
  'w-full rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2.5 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] placeholder:text-[var(--goalops-text-subtle)] focus:bg-[var(--goalops-surface)] focus:ring-2 disabled:opacity-60'

type MemberDraft = {
  id: string | null
  name: string
  role: string
  team: string
  weekly_available_hours: string
  status: 'active' | 'inactive'
}

const emptyDraft: MemberDraft = {
  id: null,
  name: '',
  role: '',
  team: '',
  weekly_available_hours: '40',
  status: 'active',
}

function draftFromMember(m: RecordModel): MemberDraft {
  return {
    id: m.id,
    name: String(m.name ?? ''),
    role: String(m.role ?? ''),
    team: String(m.team ?? ''),
    weekly_available_hours: String(m.weekly_available_hours ?? 40),
    status: String(m.status ?? 'active') === 'inactive' ? 'inactive' : 'active',
  }
}

function formatPocketBaseError(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err)
  const e = err as { message?: unknown; data?: { data?: Record<string, { message?: string }> } }
  const details = e.data?.data
  if (details && typeof details === 'object') {
    const lines = Object.entries(details)
      .map(([field, value]) => `${field}: ${value?.message ?? '字段校验失败'}`)
      .filter(Boolean)
    if (lines.length) return lines.join('；')
  }
  return typeof e.message === 'string' ? e.message : String(err)
}

function isInvalidStatusValueError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { data?: { data?: Record<string, { code?: string }> } }
  return e.data?.data?.status?.code === 'validation_invalid_value'
}

export function PeopleManagePage() {
  const [members, setMembers] = useState<RecordModel[]>([])
  const [draft, setDraft] = useState<MemberDraft>(emptyDraft)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFieldAvailable, setStatusFieldAvailable] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await pb.collection('members').getFullList({
        sort: 'name',
        batch: 500,
        requestKey: `people_manage_members_${Date.now()}`,
      })
      setMembers(rows)
      setStatusFieldAvailable(rows.some((row) => {
        const status = String(row.status ?? '').trim()
        return status === 'active' || status === 'inactive'
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return members
    return members.filter((m) => {
      const text = `${m.name ?? ''} ${m.role ?? ''} ${m.team ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [members, query])

  function patch<K extends keyof MemberDraft>(key: K, value: MemberDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!draft.name.trim()) {
      setError('请填写成员姓名')
      return
    }
    if (!draft.role.trim()) {
      setError('请填写成员角色')
      return
    }
    const hours = Number(draft.weekly_available_hours)
    if (Number.isNaN(hours) || hours <= 0 || !Number.isInteger(hours)) {
      setError('每周可用工时必须是大于 0 的整数')
      return
    }

    const payload: Record<string, unknown> = {
      name: draft.name.trim(),
      role: draft.role.trim(),
      team: draft.team.trim(),
      weekly_available_hours: hours,
    }
    if (statusFieldAvailable) payload.status = draft.status

    setSaving(true)
    try {
      try {
        if (draft.id) await pb.collection('members').update(draft.id, payload)
        else await pb.collection('members').create(payload)
      } catch (err) {
        if (!('status' in payload) || !isInvalidStatusValueError(err)) throw err
        const { status: _status, ...fallbackPayload } = payload
        setStatusFieldAvailable(false)
        if (draft.id) await pb.collection('members').update(draft.id, fallbackPayload)
        else await pb.collection('members').create(fallbackPayload)
      }
      setDraft(emptyDraft)
      await load()
    } catch (err) {
      setError(formatPocketBaseError(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(m: RecordModel) {
    const next = String(m.status ?? 'active') === 'inactive' ? 'active' : 'inactive'
    try {
      await pb.collection('members').update(m.id, { status: next })
      await load()
    } catch (err) {
      setError(formatPocketBaseError(err))
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--goalops-text)]">管理团队成员</h1>
          <p className="mt-1 text-sm text-[var(--goalops-text-muted)]">
            维护成员姓名、角色、团队、每周可用工时和在岗状态。
          </p>
        </div>
        <Link
          to="/people"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-4 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="size-4" aria-hidden />
          返回人员看板
        </Link>
      </header>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={onSubmit}>
          <SectionCard title={draft.id ? '编辑成员' : '新增成员'}>
            <div className="space-y-4">
              <label>
                <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">姓名 *</span>
                <input className={`${inputCls} mt-1.5`} value={draft.name} onChange={(e) => patch('name', e.target.value)} />
              </label>
              <label>
                <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">角色 *</span>
                <input className={`${inputCls} mt-1.5`} value={draft.role} onChange={(e) => patch('role', e.target.value)} />
              </label>
              <label>
                <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">团队</span>
                <input className={`${inputCls} mt-1.5`} value={draft.team} onChange={(e) => patch('team', e.target.value)} />
              </label>
              <label>
                <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">每周可用工时 *</span>
                <input type="number" min={1} step={1} className={`${inputCls} mt-1.5`} value={draft.weekly_available_hours} onChange={(e) => patch('weekly_available_hours', e.target.value)} />
              </label>
              {statusFieldAvailable ? (
                <label>
                  <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">状态</span>
                  <select className={`${inputCls} mt-1.5`} value={draft.status} onChange={(e) => patch('status', e.target.value as MemberDraft['status'])}>
                    <option value="active">在岗</option>
                    <option value="inactive">停用</option>
                  </select>
                </label>
              ) : null}

              {error ? <p className="rounded-xl border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger)]/10 px-3 py-2 text-sm text-[var(--goalops-danger)]">{error}</p> : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setDraft(emptyDraft)} className="rounded-xl border border-[var(--goalops-border)] px-4 py-2 text-sm font-medium text-[var(--goalops-text)]">
                  清空
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? '保存中...' : draft.id ? '保存成员' : '新增成员'}
                </button>
              </div>
            </div>
          </SectionCard>
        </form>

        <SectionCard
          title={`成员列表 (${filtered.length})`}
          action={
            <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--goalops-text-muted)]">
              <UsersRound className="size-4 text-[var(--goalops-primary)]" aria-hidden />
              PocketBase members
            </span>
          }
        >
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--goalops-text-subtle)]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索成员、角色或团队"
              className={`${inputCls} pl-10`}
            />
          </div>

          {loading ? <p className="text-sm text-[var(--goalops-text-muted)]">正在加载...</p> : null}

          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-[var(--goalops-border)] bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                  <th className="px-5 py-3">姓名</th>
                  <th className="px-5 py-3">角色</th>
                  <th className="px-5 py-3">团队</th>
                  <th className="px-5 py-3">周可用工时</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--goalops-border)]">
                {filtered.map((m) => {
                  const active = String(m.status ?? 'active') !== 'inactive'
                  return (
                    <tr key={m.id} className="bg-[var(--goalops-surface)] hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-medium text-[var(--goalops-text)]">{String(m.name ?? '')}</td>
                      <td className="px-5 py-3 text-[var(--goalops-text-muted)]">{String(m.role ?? '')}</td>
                      <td className="px-5 py-3 text-[var(--goalops-text-muted)]">{String(m.team ?? '') || '—'}</td>
                      <td className="px-5 py-3 tabular-nums text-[var(--goalops-text-muted)]">{String(m.weekly_available_hours ?? 40)}h</td>
                      <td className="px-5 py-3">
                        <StatusPill tone={active ? 'success' : 'neutral'}>{active ? '在岗' : '停用'}</StatusPill>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setDraft(draftFromMember(m))} className="text-sm font-semibold text-[var(--goalops-primary)] hover:underline">
                            编辑
                          </button>
                          {statusFieldAvailable ? (
                            <button type="button" onClick={() => void toggleStatus(m)} className="text-sm font-semibold text-[var(--goalops-text-muted)] hover:text-[var(--goalops-danger)] hover:underline">
                              {active ? '停用' : '启用'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
