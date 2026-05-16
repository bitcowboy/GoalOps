import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { pb } from '../../services/pocketbase'

export type ParticipantsFormMember = { id: string; name: string }

export type ParticipantsFormProps = {
  objectiveId: string
  members: ParticipantsFormMember[]
  /** 目标当前 owner 的 id，编辑时灰掉 / 排除 */
  ownerId?: string
  /** 当前已有的参与者 id 列表 */
  initialIds: string[]
  onSuccess: (nextIds: string[]) => void
  onCancel: () => void
}

export function ParticipantsForm({
  objectiveId,
  members,
  ownerId,
  initialIds,
  onSuccess,
  onCancel,
}: ParticipantsFormProps) {
  const [selected, setSelected] = useState<string[]>(initialIds)
  const [filter, setFilter] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectable = useMemo(
    () => members.filter((m) => m.id !== ownerId),
    [members, ownerId],
  )
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return selectable
    return selectable.filter((m) => m.name.toLowerCase().includes(q))
  }, [selectable, filter])

  function toggle(id: string): void {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSave(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      // 防御：剔掉 owner（即便误传也不要存进去）
      const next = selected.filter((id) => id !== ownerId)
      await pb.collection('objectives').update(objectiveId, { participant_ids: next })
      onSuccess(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--goalops-border)] px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--goalops-text)]">编辑参与者</h3>
            <p className="mt-0.5 text-xs text-[var(--goalops-text-muted)]">勾选除负责人外的协作成员</p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--goalops-text-muted)] hover:bg-slate-100"
            onClick={onCancel}
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索成员…"
            className="w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
          />

          {selectable.length === 0 ? (
            <p className="text-xs text-[var(--goalops-text-subtle)]">没有可选成员（除负责人外暂无在岗成员）。</p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-[var(--goalops-border)] bg-white p-2">
              {filtered.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[var(--goalops-text-subtle)]">无匹配结果</p>
              ) : (
                <ul className="space-y-1">
                  {filtered.map((m) => {
                    const checked = selected.includes(m.id)
                    return (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(m.id)}
                            className="size-3.5 rounded border-[var(--goalops-border)] text-[var(--goalops-primary)]"
                          />
                          <span>{m.name}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          <p className="text-[11px] text-[var(--goalops-text-muted)]">
            已选 {selected.length} 人{ownerId ? '（负责人不计入）' : ''}
          </p>

          {error ? (
            <div className="rounded-lg border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger-soft)] px-3 py-2 text-xs text-[var(--goalops-danger)]" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--goalops-border)] bg-slate-50/60 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--goalops-text-muted)] hover:bg-slate-100"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="rounded-lg bg-[var(--goalops-primary)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
