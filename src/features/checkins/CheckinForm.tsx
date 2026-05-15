import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type {
  CheckinType,
  KRCheckin,
  KRType,
  StatusSignal,
} from '../../models'
import {
  type CheckinDraft,
  createCheckin,
  deriveStatusFromConfidence,
  updateCheckin,
} from './service'
import { checkinTypeLabel, statusSignalDot, statusSignalLabel } from './statusSignal'

type KRForForm = {
  id: string
  name: string
  kr_type: KRType
  owner?: string
  start_value?: number | null
  target_value?: number | null
  unit?: string
}

type CheckinFormProps = {
  kr: KRForForm
  members: Array<{ id: string; name: string }>
  existing?: KRCheckin
  onSuccess: (saved: KRCheckin) => void
  onCancel: () => void
}

const CHECKIN_TYPES: CheckinType[] = ['weekly', 'milestone', 'adhoc']

function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function CheckinForm({ kr, members, existing, onSuccess, onCancel }: CheckinFormProps) {
  const editing = Boolean(existing)
  const today = todayISO()

  const [checkinDate, setCheckinDate] = useState<string>(existing?.checkinDate ?? today)
  const [checkinType, setCheckinType] = useState<CheckinType>(existing?.checkinType ?? 'weekly')
  const [confidence, setConfidence] = useState<number>(existing?.confidence ?? 7)
  const [statusManual, setStatusManual] = useState<StatusSignal | null>(existing?.statusSignal ?? null)
  const [progressNote, setProgressNote] = useState<string>(existing?.progressNote ?? '')
  const [blockersNote, setBlockersNote] = useState<string>(existing?.blockersNote ?? '')
  const [nextFocus, setNextFocus] = useState<string>(existing?.nextFocus ?? '')
  const [currentValue, setCurrentValue] = useState<string>(
    existing?.currentValue != null ? String(existing.currentValue) : '',
  )
  const [progressPercent, setProgressPercent] = useState<number>(
    existing?.progressPercent != null ? existing.progressPercent : 0,
  )
  const [isCompleted, setIsCompleted] = useState<boolean>(existing?.isCompleted ?? false)
  const [author, setAuthor] = useState<string>(existing?.authorId ?? kr.owner ?? '')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 当 KR.owner 异步加载到位时，自动把 author 默认值补上（仅创建模式、用户未改过）。
  const ownerSeededRef = useRef(false)
  useEffect(() => {
    if (editing) return
    if (ownerSeededRef.current) return
    if (author) {
      ownerSeededRef.current = true
      return
    }
    if (kr.owner) {
      ownerSeededRef.current = true
      queueMicrotask(() => setAuthor(kr.owner ?? ''))
    }
  }, [editing, author, kr.owner])

  const effectiveStatus: StatusSignal = statusManual ?? deriveStatusFromConfidence(confidence)

  const validationError = useMemo<string | null>(() => {
    if (!progressNote.trim()) return '请填写进度说明'
    if (!author) return '请选择提交人'
    if (!checkinDate) return '请选择 check-in 日期'
    if (checkinDate > today) return 'check-in 日期不能晚于今天'
    if (kr.kr_type === 'metric') {
      if (currentValue.trim() === '') return '请填写 current_value'
      if (!Number.isFinite(Number(currentValue))) return 'current_value 必须是数字'
    } else if (kr.kr_type === 'milestone') {
      if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100)
        return 'progress_percent 必须在 0–100 之间'
    }
    if (!Number.isInteger(confidence) || confidence < 1 || confidence > 10) return 'confidence 必须为 1–10 整数'
    return null
  }, [author, checkinDate, confidence, currentValue, kr.kr_type, progressNote, progressPercent, today])

  async function doSubmit(): Promise<void> {
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const base: Partial<CheckinDraft> = {
        checkin_date: checkinDate,
        checkin_type: checkinType,
        confidence,
        status_signal: effectiveStatus,
        progress_note: progressNote.trim(),
        blockers_note: blockersNote.trim() || undefined,
        next_focus: nextFocus.trim() || undefined,
        author,
      }
      // 度量字段按类型注入
      if (kr.kr_type === 'metric') {
        base.current_value = Number(currentValue)
      } else if (kr.kr_type === 'milestone') {
        base.progress_percent = progressPercent
      } else {
        base.is_completed = isCompleted
      }

      if (existing) {
        // 编辑模式：checkin_date 锁定，不发送
        const rest = { ...base }
        delete (rest as Partial<CheckinDraft>).checkin_date
        const saved = await updateCheckin(existing.id, rest)
        onSuccess(saved)
      } else {
        const draft: CheckinDraft = {
          key_result: kr.id,
          checkin_date: checkinDate,
          checkin_type: checkinType,
          confidence,
          status_signal: effectiveStatus,
          progress_note: progressNote.trim(),
          blockers_note: blockersNote.trim() || undefined,
          next_focus: nextFocus.trim() || undefined,
          author,
        }
        if (kr.kr_type === 'metric') draft.current_value = Number(currentValue)
        else if (kr.kr_type === 'milestone') draft.progress_percent = progressPercent
        else draft.is_completed = isCompleted
        const saved = await createCheckin(draft)
        onSuccess(saved)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setConfirming(false)
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
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--goalops-border)] px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--goalops-text)]">
              {editing ? '编辑 Check-in' : '新建 Check-in'}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--goalops-text-muted)]">KR：{kr.name}</p>
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
          {/* checkin_date + checkin_type */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">日期</span>
              <input
                type="date"
                value={checkinDate}
                max={today}
                disabled={editing}
                onChange={(e) => setCheckinDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-[var(--goalops-text-muted)]"
              />
              {editing ? (
                <span className="mt-1 block text-[11px] text-[var(--goalops-text-subtle)]">编辑模式下日期已锁定</span>
              ) : null}
            </label>
            <div>
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">类型</span>
              <div className="mt-1 inline-flex rounded-lg border border-[var(--goalops-border)] bg-white p-0.5">
                {CHECKIN_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCheckinType(t)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      checkinType === t
                        ? 'bg-[var(--goalops-primary)] text-white'
                        : 'text-[var(--goalops-text-muted)] hover:bg-slate-50'
                    }`}
                  >
                    {checkinTypeLabel(t)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* metric / checkbox / milestone field */}
          <MetricField
            kr={kr}
            currentValue={currentValue}
            setCurrentValue={setCurrentValue}
            progressPercent={progressPercent}
            setProgressPercent={setProgressPercent}
            isCompleted={isCompleted}
            setIsCompleted={setIsCompleted}
          />

          {/* confidence */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">信心 (1–10)</span>
              <button
                type="button"
                onClick={() => setStatusManual(null)}
                className="text-[11px] text-[var(--goalops-text-subtle)] underline hover:text-[var(--goalops-text-muted)]"
                title="还原为按 confidence 自动派生"
              >
                {statusManual ? '已手动覆盖 · 点此还原' : '自动派生中'}
              </button>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-8 text-center text-sm font-semibold text-[var(--goalops-text)]">{confidence}</span>
            </div>
            <div className="mt-2 flex gap-2 text-[11px]">
              {(['on_track', 'at_risk', 'off_track'] as StatusSignal[]).map((s) => {
                const active = effectiveStatus === s
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusManual(s)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${
                      active
                        ? 'border-[var(--goalops-primary)] bg-[var(--goalops-primary)]/10'
                        : 'border-[var(--goalops-border)] hover:bg-slate-50'
                    }`}
                  >
                    <span className={`inline-block size-2 rounded-full ${statusSignalDot(s)}`} />
                    {statusSignalLabel(s)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* notes */}
          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">进度说明 *</span>
            <textarea
              rows={3}
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="这周做了什么？数据现在是多少？"
              className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">本周阻塞</span>
            <textarea
              rows={2}
              value={blockersNote}
              onChange={(e) => setBlockersNote(e.target.value)}
              placeholder="遇到了什么？还不需要开 blocker"
              className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">下周聚焦</span>
            <textarea
              rows={2}
              value={nextFocus}
              onChange={(e) => setNextFocus(e.target.value)}
              placeholder="下周的 1-3 个聚焦点"
              className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            />
          </label>

          {/* author */}
          <label className="block">
            <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">提交人</span>
            <select
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
            >
              <option value="">— 选择成员 —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <div className="rounded-lg border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger-soft)] px-3 py-2 text-xs text-[var(--goalops-danger)]" role="alert">
              {error}
            </div>
          ) : null}
        </div>

        {!confirming ? (
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
              onClick={() => {
                if (validationError) {
                  setError(validationError)
                  return
                }
                setError(null)
                setConfirming(true)
              }}
              className="rounded-lg bg-[var(--goalops-primary)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {editing ? '保存' : '提交'}
            </button>
          </div>
        ) : (
          <div className="border-t border-[var(--goalops-border)] bg-slate-50/60 px-5 py-3">
            <p className="text-sm text-[var(--goalops-text)]">
              确认{editing ? '保存' : '提交'} {checkinDate} 的 check-in？
              <span className="ml-2 text-[var(--goalops-text-muted)]">
                信心 {confidence} · {statusSignalLabel(effectiveStatus)}
              </span>
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="rounded-lg px-3 py-1.5 text-sm text-[var(--goalops-text-muted)] hover:bg-slate-100"
              >
                返回修改
              </button>
              <button
                type="button"
                onClick={() => void doSubmit()}
                disabled={busy}
                className="rounded-lg bg-[var(--goalops-primary)] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
              >
                {busy ? '提交中…' : '确认'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricField({
  kr,
  currentValue,
  setCurrentValue,
  progressPercent,
  setProgressPercent,
  isCompleted,
  setIsCompleted,
}: {
  kr: KRForForm
  currentValue: string
  setCurrentValue: (v: string) => void
  progressPercent: number
  setProgressPercent: (v: number) => void
  isCompleted: boolean
  setIsCompleted: (v: boolean) => void
}) {
  if (kr.kr_type === 'metric') {
    const start = kr.start_value
    const target = kr.target_value
    return (
      <div>
        <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">
          当前值 ({kr.unit || '—'})
        </span>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            className="w-40 rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
          />
          {kr.unit ? <span className="text-xs text-[var(--goalops-text-muted)]">{kr.unit}</span> : null}
          {start != null && target != null ? (
            <span className="text-[11px] text-[var(--goalops-text-subtle)]">
              start: {start} → target: {target}
            </span>
          ) : null}
        </div>
      </div>
    )
  }
  if (kr.kr_type === 'milestone') {
    return (
      <div>
        <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">完成进度 (0–100)</span>
        <div className="mt-1 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progressPercent}
            onChange={(e) => setProgressPercent(Number(e.target.value))}
            className="flex-1"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => setProgressPercent(Number(e.target.value))}
            className="w-20 rounded-lg border border-[var(--goalops-border)] bg-white px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-[var(--goalops-text-muted)]">%</span>
        </div>
      </div>
    )
  }
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={(e) => setIsCompleted(e.target.checked)}
        className="size-4 rounded border-[var(--goalops-border)] text-[var(--goalops-primary)]"
      />
      <span className="text-xs font-semibold text-[var(--goalops-text-muted)]">已完成</span>
    </label>
  )
}
