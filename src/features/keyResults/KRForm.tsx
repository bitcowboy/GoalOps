import { useMemo, useState } from 'react'
import type { RecordModel } from 'pocketbase'
import { X } from 'lucide-react'
import { pb } from '../../services/pocketbase'
import type { KRDirection, KRType } from '../../models'

export type KRFormMember = { id: string; name: string }

export type KRFormProps = {
  objectiveId: string
  members: KRFormMember[]
  /** 编辑模式传入；不传则为创建模式 */
  existing?: RecordModel
  onSuccess: (saved: RecordModel) => void
  onDelete?: () => void
  onCancel: () => void
}

type DirectionOrEmpty = KRDirection | ''

function readContributors(rec?: RecordModel): string[] {
  if (!rec) return []
  const raw = (rec as { contributors?: unknown }).contributors
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string')
  if (typeof raw === 'string' && raw.trim()) {
    // PB 偶尔以空格/逗号分隔多关系返回 — 容错
    return raw.split(/[\s,]+/).filter(Boolean)
  }
  return []
}

export function KRForm({
  objectiveId,
  members,
  existing,
  onSuccess,
  onDelete,
  onCancel,
}: KRFormProps) {
  const editing = Boolean(existing)

  const [name, setName] = useState<string>(String(existing?.name ?? ''))
  const [krType, setKrType] = useState<KRType>(
    ((existing?.kr_type as KRType | undefined) ?? 'checkbox') as KRType,
  )
  const [isCompleted, setIsCompleted] = useState<boolean>(Boolean(existing?.is_completed))
  const [owner, setOwner] = useState<string>(
    typeof existing?.owner === 'string' ? (existing.owner as string) : '',
  )
  const [contributors, setContributors] = useState<string[]>(readContributors(existing))
  const [note, setNote] = useState<string>(String(existing?.note ?? ''))
  const [sortOrder, setSortOrder] = useState<string>(
    typeof existing?.sort_order === 'number' ? String(existing.sort_order) : '',
  )

  // metric-only fields
  const [startValue, setStartValue] = useState<string>(
    existing?.start_value != null && existing?.start_value !== '' ? String(existing.start_value) : '',
  )
  const [targetValue, setTargetValue] = useState<string>(
    existing?.target_value != null && existing?.target_value !== '' ? String(existing.target_value) : '',
  )
  const [unit, setUnit] = useState<string>(String(existing?.unit ?? ''))
  const [direction, setDirection] = useState<DirectionOrEmpty>(
    ((existing?.direction as DirectionOrEmpty | undefined) ?? '') as DirectionOrEmpty,
  )

  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validationError = useMemo<string | null>(() => {
    if (!name.trim()) return '请填写 KR 名称'
    if (krType === 'metric') {
      if (startValue.trim() === '') return 'metric KR 需要 start_value'
      if (targetValue.trim() === '') return 'metric KR 需要 target_value'
      if (!Number.isFinite(Number(startValue))) return 'start_value 必须是数字'
      if (!Number.isFinite(Number(targetValue))) return 'target_value 必须是数字'
      if (!unit.trim()) return 'metric KR 需要 unit'
      if (direction !== 'increase' && direction !== 'decrease')
        return 'metric KR 需要 direction (increase/decrease)'
    }
    if (sortOrder.trim() && !Number.isInteger(Number(sortOrder)))
      return 'sort_order 必须是整数'
    return null
  }, [direction, krType, name, sortOrder, startValue, targetValue, unit])

  async function handleSave(): Promise<void> {
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        kr_type: krType,
        is_completed: krType === 'checkbox' ? isCompleted : false,
        owner: owner || null,
        contributors,
        note: note.trim(),
      }
      if (sortOrder.trim()) payload.sort_order = Number(sortOrder)

      if (krType === 'metric') {
        payload.start_value = Number(startValue)
        payload.target_value = Number(targetValue)
        payload.unit = unit.trim()
        payload.direction = direction
      } else {
        // 非 metric：把 metric 字段显式清空（数字回 0；select 回 ""）
        payload.start_value = null
        payload.target_value = null
        payload.unit = ''
        payload.direction = ''
      }

      let saved: RecordModel
      if (existing) {
        saved = await pb.collection('key_results').update(existing.id, payload)
      } else {
        saved = await pb.collection('key_results').create({ ...payload, objective: objectiveId })
      }
      onSuccess(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!existing || !onDelete) return
    setBusy(true)
    setError(null)
    try {
      await pb.collection('key_results').delete(existing.id)
      onDelete()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  function toggleContributor(id: string): void {
    setContributors((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-12"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--goalops-border)] px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--goalops-text)]">
              {editing ? '编辑关键结果' : '新建关键结果'}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--goalops-text-muted)]">
              {editing ? `KR 编号 ${existing!.id}` : '为当前目标新增一条 KR'}
            </p>
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

        <div className="space-y-4 px-5 py-4 text-sm">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">名称 *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：auto_pass_rate 6/30 前 ≥85%"
              className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>

          <div>
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">类型 *</span>
            <div className="mt-1 inline-flex rounded-lg border border-[var(--goalops-border)] bg-white p-0.5">
              {(['metric', 'checkbox', 'milestone'] as KRType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setKrType(t)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    krType === t
                      ? 'bg-[var(--goalops-primary)] text-white'
                      : 'text-[var(--goalops-text-muted)] hover:bg-slate-50'
                  }`}
                >
                  {t === 'metric' ? 'Metric' : t === 'milestone' ? 'Milestone' : 'Checkbox'}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--goalops-text-subtle)]">
              metric = 数字度量 / checkbox = 做了否 / milestone = 阶段百分比
            </p>
          </div>

          {krType === 'metric' ? (
            <div className="space-y-3 rounded-xl border border-[var(--goalops-border)] bg-slate-50/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--goalops-text-muted)]">
                Metric 配置
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">start_value *</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={startValue}
                    onChange={(e) => setStartValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">target_value *</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">unit *</span>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="% / ms / 人"
                    className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">direction *</span>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as DirectionOrEmpty)}
                    className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="">— 选择方向 —</option>
                    <option value="increase">increase(越高越好)</option>
                    <option value="decrease">decrease(越低越好)</option>
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {krType === 'checkbox' ? (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="size-4 rounded border-[var(--goalops-border)] text-[var(--goalops-primary)]"
              />
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">已完成</span>
            </label>
          ) : null}

          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">负责人</span>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            >
              <option value="">— 未指定 —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">
              贡献者 (contributors)
              <span className="ml-1 text-[10px] font-normal text-[var(--goalops-text-subtle)]">
                · 多选 · 可与负责人不同
              </span>
            </span>
            {members.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--goalops-text-subtle)]">暂无成员可选</p>
            ) : (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-[var(--goalops-border)] bg-white p-2">
                <ul className="space-y-1">
                  {members.map((m) => {
                    const checked = contributors.includes(m.id)
                    return (
                      <li key={m.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleContributor(m.id)}
                            className="size-3.5 rounded border-[var(--goalops-border)] text-[var(--goalops-primary)]"
                          />
                          <span>{m.name}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            {contributors.length > 0 ? (
              <p className="mt-1 text-[11px] text-[var(--goalops-text-muted)]">
                已选 {contributors.length} 人
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">备注</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="可选：补充说明"
              className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">
              排序 sort_order
              <span className="ml-1 text-[10px] font-normal text-[var(--goalops-text-subtle)]">· 小的排前面</span>
            </span>
            <input
              type="number"
              inputMode="numeric"
              step={1}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="mt-1 w-32 rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger-soft)] px-3 py-2 text-xs text-[var(--goalops-danger)]" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--goalops-border)] bg-slate-50/60 px-5 py-3">
          <div>
            {editing && onDelete ? (
              confirmDelete ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-[var(--goalops-danger)]">确认删除？关联 check-in 会一起被删除。</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete()}
                    className="rounded-md bg-[var(--goalops-danger)] px-2 py-0.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
                  >
                    {busy ? '删除中…' : '确认删除'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md px-2 py-0.5 text-xs text-[var(--goalops-text-muted)] hover:bg-slate-100"
                  >
                    取消
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="rounded-md px-2 py-1 text-xs text-[var(--goalops-danger)] hover:bg-[var(--goalops-danger-soft)]"
                >
                  删除 KR
                </button>
              )
            ) : null}
          </div>
          <div className="flex items-center gap-2">
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
              {busy ? '保存中…' : editing ? '保存' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
