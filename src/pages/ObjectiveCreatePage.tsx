import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Calendar, ChevronDown, ChevronRight, ClipboardList, FileText, Lightbulb, Target, TrendingUp, Users as UsersIcon } from 'lucide-react'
import { ProgressBar, SectionCard, StatusPill } from '@/components'
import {
  createObjective,
  fetchObjectiveOwnerOptions,
  fetchObjectiveStatusPriorityOptions,
  normalizeObjectiveLinesField,
  OBJECTIVE_PRIORITY_VALUES,
  OBJECTIVE_STATUS_VALUES,
  objectiveDraftToCreateInput,
  type ObjectiveDraftDeliverableRow,
  type ObjectiveOwnerOption,
  type ObjectiveSelectOption,
} from '@/features/objectives/createObjective'
import {
  objectiveFormInputCls as baseInputCls,
  objectiveFormLabelCls as baseLabelCls,
  objectiveFormSelectCls as baseSelectCls,
  objectiveRecordStatusTone,
} from '@/features/objectives/objectiveFormTokens'
import {
  formatDotDate,
  initialsFromName,
  coerceObjectiveStatusForWrite,
  objectiveStatusLabel,
  priorityPillTone,
  clampPercent,
} from '@/features/objectives/objectiveDetailUtils'

/** 创建页专用：略小的标签与控件垂直空间，整体更紧凑 */
const inputCls = `${baseInputCls} py-2 text-[13px] leading-snug`
const selectCls = `${baseSelectCls} py-2 text-[13px] leading-snug`
const labelCls = `${baseLabelCls} text-[13px]`

const FORM_ID = 'objective-create-form'
const DRAFT_STORAGE_KEY = 'goalops_objective_create_draft_v1'

/** 旧草稿里的 current_phase PB 取值 → 7 档 status */
const LEGACY_PHASE_TO_STATUS: Record<string, string> = {
  discovery: 'explore_plan',
  planning: 'explore_plan',
  execution: 'in_progress',
  review: 'in_review',
  paused: 'paused',
}

const AVATAR_COLORS = ['#7c3aed', '#2563eb', '#ea580c', '#16a34a', '#db2777', '#0d9488']

function fallbackSelectOptions(): {
  statuses: ObjectiveSelectOption[]
  priorities: ObjectiveSelectOption[]
} {
  return {
    statuses: OBJECTIVE_STATUS_VALUES.map((value) => ({
      value,
      label: objectiveStatusLabel(value),
    })),
    priorities: OBJECTIVE_PRIORITY_VALUES.map((value) => ({ value, label: value })),
  }
}

function pickDefaultStatus(statuses: ObjectiveSelectOption[]): string {
  const prefers = ['not_started', '未开始']
  for (const v of prefers) {
    const hit = statuses.find((o) => o.value === v)
    if (hit) return hit.value
  }
  return statuses[0]?.value ?? ''
}

function pickDefaultPriority(priorities: ObjectiveSelectOption[]): string {
  const p2 = priorities.find((o) => o.value === 'P2')
  if (p2) return p2.value
  return priorities[0]?.value ?? ''
}

type CoreDocLinkRow = { title: string; url: string }

type FormState = {
  name: string
  one_sentence_definition: string
  background: string
  success_criteria: string
  out_of_scope: string
  owner: string
  status: string
  priority: string
  start_date: string
  due_date: string
  participant_ids: string[]
  risk_level: string
  /** 每行一条交付件，保存为 draft_deliverables 列表 */
  deliverables_bullets: string
  /** 核心文档仅保存名称 + 外链，无需上传 */
  core_document_links: CoreDocLinkRow[]
}

function emptyForm(): FormState {
  return {
    name: '',
    one_sentence_definition: '',
    background: '',
    success_criteria: '',
    out_of_scope: '',
    owner: '',
    status: '',
    priority: '',
    start_date: '',
    due_date: '',
    participant_ids: [],
    risk_level: '',
    deliverables_bullets: '',
    core_document_links: [],
  }
}

function deliverableRowsFromBullets(text: string): ObjectiveDraftDeliverableRow[] {
  return normalizeObjectiveLinesField(text).map((title) => ({
    title,
    planned_completion_date: '',
  }))
}

function parseStoredCreateDraft(raw: unknown): FormState | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const b = emptyForm()
  const pickStr = (key: keyof FormState): string => {
    const v = p[key]
    return typeof v === 'string' ? v : (b[key] as string)
  }
  const participant_ids = Array.isArray(p.participant_ids)
    ? p.participant_ids.filter((x): x is string => typeof x === 'string')
    : b.participant_ids

  let deliverables_bullets = b.deliverables_bullets
  if (typeof p.deliverables_bullets === 'string') {
    deliverables_bullets = p.deliverables_bullets
  } else if (Array.isArray(p.draft_deliverables)) {
    deliverables_bullets = p.draft_deliverables
      .filter(
        (x): x is Record<string, unknown> =>
          !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).title === 'string',
      )
      .map((x) => String(x.title ?? '').trim())
      .filter(Boolean)
      .join('\n')
  }

  let core_document_links = b.core_document_links
  if (Array.isArray(p.core_document_links)) {
    core_document_links = p.core_document_links
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x) => ({
        title: typeof x.title === 'string' ? x.title : '',
        url: typeof x.url === 'string' ? x.url : '',
      }))
  } else if (Array.isArray(p.draft_core_documents)) {
    core_document_links = p.draft_core_documents
      .filter(
        (x): x is Record<string, unknown> =>
          !!x && typeof x === 'object' && typeof (x as Record<string, unknown>).title === 'string',
      )
      .map((x) => {
        let url = typeof x.url === 'string' ? x.url.trim() : ''
        if (!url) {
          const ver = String(x.version ?? '').trim()
          if (ver.startsWith('http://') || ver.startsWith('https://')) url = ver
        }
        return { title: String(x.title ?? ''), url }
      })
  }

  let status = pickStr('status')
  const legacyPhase = typeof p.current_phase === 'string' ? p.current_phase.trim() : ''
  const fromPhase = legacyPhase ? LEGACY_PHASE_TO_STATUS[legacyPhase] : undefined
  if (fromPhase) {
    const st = status.trim()
    const generic =
      !st || st === 'draft' || st === '草稿' || st === 'not_started' || st === '未开始'
    if (generic) status = fromPhase
  }

  status = coerceObjectiveStatusForWrite(status)

  return {
    ...b,
    name: pickStr('name'),
    one_sentence_definition: pickStr('one_sentence_definition'),
    background: pickStr('background'),
    success_criteria: pickStr('success_criteria'),
    out_of_scope: pickStr('out_of_scope'),
    owner: pickStr('owner'),
    status,
    priority: pickStr('priority'),
    start_date: pickStr('start_date'),
    due_date: pickStr('due_date'),
    participant_ids,
    risk_level: pickStr('risk_level'),
    deliverables_bullets,
    core_document_links,
  }
}

function charCount(s: string): number {
  return [...s].length
}

function FormCharHint({ cur, max }: { cur: number; max: number }) {
  return (
    <span className="pointer-events-none text-[10px] tabular-nums text-[var(--goalops-text-subtle)]">
      {Math.min(cur, max)}/{max}
    </span>
  )
}

function chipColor(i: number): string {
  return AVATAR_COLORS[i % AVATAR_COLORS.length]!
}

function CompletionDonut({ value }: { value: number }) {
  const pct = clampPercent(value)
  const cx = 44
  const cy = 44
  const radius = 34
  const c = 2 * Math.PI * radius
  const dash = (pct / 100) * c

  return (
    <div className="relative mx-auto flex size-[88px] items-center justify-center">
      <svg className="-rotate-90" width="88" height="88" aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(148,163,184,0.25)"
          strokeWidth="8"
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="var(--goalops-danger)"
          strokeWidth="8"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-tight">
        <span className="text-lg font-semibold tabular-nums text-[var(--goalops-text)]">{pct}%</span>
        <span className="text-[10px] text-[var(--goalops-text-subtle)]">已填</span>
      </div>
    </div>
  )
}

function SectionProgressRow({
  tone,
  label,
  fraction,
}: {
  tone: string
  label: string
  fraction: string
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px] leading-tight">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`mt-1 inline-block size-2 shrink-0 rounded-full ${tone}`} aria-hidden />
        <span className="text-[var(--goalops-text)]">{label}</span>
      </div>
      <span className="font-medium tabular-nums text-[var(--goalops-text-muted)]">{fraction}</span>
    </div>
  )
}

export function ObjectiveCreatePage() {
  const navigate = useNavigate()
  const [members, setMembers] = useState<ObjectiveOwnerOption[]>([])
  const [membersError, setMembersError] = useState<string | null>(null)
  const [membersLoading, setMembersLoading] = useState(true)
  const [form, setForm] = useState<FormState>(() => emptyForm())
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [draftSavedHint, setDraftSavedHint] = useState<string | null>(null)
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(true)
  const hydratedRef = useRef(false)

  const [selectOptions, setSelectOptions] = useState<{
    statuses: ObjectiveSelectOption[]
    priorities: ObjectiveSelectOption[]
  } | null>(null)

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    setMembersError(null)
    try {
      const list = await fetchObjectiveOwnerOptions()
      setMembers(list)
    } catch (e) {
      setMembers([])
      setMembersError(e instanceof Error ? e.message : String(e))
    } finally {
      setMembersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const opts = await fetchObjectiveStatusPriorityOptions()
        if (cancelled) return
        setSelectOptions(opts)
        setForm((f) => {
          const statusCoerced = coerceObjectiveStatusForWrite(f.status)
          return {
            ...f,
            status: opts.statuses.some((x) => x.value === statusCoerced)
              ? statusCoerced
              : pickDefaultStatus(opts.statuses),
            priority: opts.priorities.some((x) => x.value === f.priority)
              ? f.priority
              : pickDefaultPriority(opts.priorities),
          }
        })
      } catch {
        const fb = fallbackSelectOptions()
        if (cancelled) return
        setSelectOptions(fb)
        setForm((f) => {
          const statusCoerced = coerceObjectiveStatusForWrite(f.status)
          return {
            ...f,
            status: fb.statuses.some((x) => x.value === statusCoerced)
              ? statusCoerced
              : pickDefaultStatus(fb.statuses),
            priority: fb.priorities.some((x) => x.value === f.priority)
              ? f.priority
              : pickDefaultPriority(fb.priorities),
          }
        })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      const next = parseStoredCreateDraft(parsed)
      if (!next) return
      setForm(next)
      setDraftSavedHint('已从本机草稿恢复填写内容')
    } catch {
      /* ignore */
    }
  }, [])

  const hasMembers = members.length > 0
  const enumsReady =
    !!selectOptions &&
    selectOptions.statuses.length > 0 &&
    selectOptions.priorities.length > 0 &&
    !!form.status &&
    !!form.priority

  const successLinesNonEmpty = useMemo(
    () => form.success_criteria.split(/\r?\n/).some((l) => l.trim().length > 0),
    [form.success_criteria],
  )

  const deliverablePreviewLines = useMemo(
    () => normalizeObjectiveLinesField(form.deliverables_bullets),
    [form.deliverables_bullets],
  )

  const completion = useMemo(() => {
    const nameOk = form.name.trim().length > 0
    const oneOk = form.one_sentence_definition.trim().length > 0
    const bgOk = form.background.trim().length > 0
    const scOk = successLinesNonEmpty
    const outOk = form.out_of_scope.trim().length > 0

    const s1 = [nameOk, oneOk, bgOk, scOk, outOk].filter(Boolean).length
    const max1 = 5

    const s2 = [
      form.priority.trim(),
      form.status.trim(),
      form.start_date.trim(),
      form.due_date.trim(),
      form.owner.trim(),
      form.risk_level.trim(),
    ].filter(Boolean).length
    const max2 = 6

    const anyDel = normalizeObjectiveLinesField(form.deliverables_bullets).length > 0
    const anyDoc = form.core_document_links.some(
      (r) => r.title.trim().length > 0 && r.url.trim().length > 0,
    )
    const s3 = [anyDel, anyDoc].filter(Boolean).length
    const max3 = 2

    const overall = Math.round(((s1 / max1 + s2 / max2 + s3 / max3) / 3) * 100)
    return { s1, max1, s2, max2, s3, max3, overall }
  }, [form, successLinesNonEmpty])

  const previewProgress = 0

  const ownerResolvedName = members.find((m) => m.id === form.owner)?.name ?? ''

  const participantNames = form.participant_ids
    .map((id) => members.find((m) => m.id === id)?.name ?? '')
    .filter(Boolean)

  const validate = useCallback((): string | null => {
    if (!form.name.trim()) return '请填写目标名称'
    if (!form.one_sentence_definition.trim()) return '请填写一句话定义'
    if (!form.background.trim()) return '请填写背景 / 价值'
    if (!successLinesNonEmpty) return '请填写成功标准（至少一行）'
    if (!form.owner.trim()) return '请选择负责人'
    if (!form.status.trim()) return '请选择状态'
    if (!form.priority.trim()) return '请选择优先级'
    if (!form.start_date.trim() || !form.due_date.trim()) return '请选择起止时间'
    if (!form.risk_level.trim()) return '请选择风险等级'
    const s = form.start_date.trim()
    const d = form.due_date.trim()
    if (s && d && s > d) return '开始日期不能晚于结束日期'

    const limits: [string, number][] = [
      [form.name, 80],
      [form.one_sentence_definition, 100],
      [form.background, 500],
      [form.success_criteria, 500],
      [form.out_of_scope, 300],
    ]
    for (const [text, max] of limits) {
      if (charCount(text) > max) return `有字段超出字数限制（最多 ${max} 字）`
    }
    return null
  }, [form, successLinesNonEmpty])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const v = validate()
    if (v) {
      setSubmitError(v)
      return
    }
    setSubmitting(true)
    try {
      const draft = {
        name: form.name,
        owner: form.owner,
        status: form.status,
        priority: form.priority,
        definition: '',
        one_sentence_definition: form.one_sentence_definition,
        background: form.background,
        success_criteria: form.success_criteria,
        out_of_scope: form.out_of_scope,
        start_date: form.start_date,
        due_date: form.due_date,
        progress_percent: '0',
        participant_ids: form.participant_ids,
        risk_level: form.risk_level,
        current_blockers_summary: '',
        action_suggestions_text: '',
        draft_deliverables: deliverableRowsFromBullets(form.deliverables_bullets),
        draft_core_documents: form.core_document_links
          .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
          .filter((r) => r.title.length > 0),
      }
      const input = objectiveDraftToCreateInput(draft)
      const meta = await createObjective(input)
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      navigate('/objectives', {
        replace: false,
        state: { objectiveCreated: true, objectiveName: meta.name },
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function persistDraftLocally() {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form))
      const t = new Date()
      const ts = `${t.getHours()}`.padStart(2, '0') + ':' + `${t.getMinutes()}`.padStart(2, '0')
      setDraftSavedHint(`草稿已保存到本机 (${ts})`)
    } catch (e) {
      setDraftSavedHint(e instanceof Error ? e.message : '无法保存草稿')
    }
    window.setTimeout(() => setDraftSavedHint(null), 4000)
  }

  const submitDisabled = submitting || membersLoading || !hasMembers || !enumsReady

  const availableToAddParticipants = members.filter((m) => !form.participant_ids.includes(m.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--goalops-border)] pb-3">
        <nav className="flex flex-wrap items-center gap-1 text-[13px] text-[var(--goalops-text-muted)]" aria-label="面包屑">
          <Link to="/objectives" className="rounded-md px-1 font-medium hover:text-[var(--goalops-text)]">
            目标
          </Link>
          <ChevronRight className="size-4 shrink-0 opacity-70" aria-hidden />
          <span className="font-semibold text-[var(--goalops-text)]">创建目标</span>
        </nav>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={persistDraftLocally}
            disabled={membersLoading}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--goalops-text)] shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            保存草稿
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={submitDisabled}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? '创建中…' : '创建目标'}
          </button>
          <Link
            to="/objectives"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
          >
            取消
          </Link>
        </div>
      </div>

      {draftSavedHint ? (
        <p className="rounded-lg border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-1.5 text-[13px] text-[var(--goalops-text-muted)]" role="status">
          {draftSavedHint}
        </p>
      ) : null}

      {membersError ? (
        <div
          className="rounded-lg border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger)]/10 px-3 py-2 text-[13px] text-[var(--goalops-danger)]"
          role="alert"
        >
          <p className="font-medium">无法加载负责人列表</p>
          <p className="mt-1 text-[var(--goalops-text-muted)]">{membersError}</p>
          <button
            type="button"
            onClick={() => void loadMembers()}
            className="mt-1.5 text-[13px] font-semibold text-[var(--goalops-primary)] hover:underline"
          >
            重试
          </button>
        </div>
      ) : null}

      {!enumsReady ? (
        <p className="text-[13px] text-[var(--goalops-warning)]">状态和优先级选项加载中…</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form id={FORM_ID} onSubmit={onSubmit} className="space-y-3">
          <SectionCard title="1 基本信息" compact>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="obj-name" className={labelCls}>
                    目标名称 <span className="text-[var(--goalops-danger)]">*</span>
                  </label>
                  <FormCharHint cur={charCount(form.name)} max={80} />
                </div>
                <input
                  id="obj-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value.slice(0, 240))}
                  maxLength={80}
                  className={`${inputCls} mt-1`}
                  placeholder="清晰、具体的目标名称"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="obj-one" className={labelCls}>
                      一句话定义 <span className="text-[var(--goalops-danger)]">*</span>
                    </label>
                    <FormCharHint cur={charCount(form.one_sentence_definition)} max={100} />
                  </div>
                  <input
                    id="obj-one"
                    type="text"
                    value={form.one_sentence_definition}
                    onChange={(e) => patch('one_sentence_definition', e.target.value.slice(0, 200))}
                    maxLength={100}
                    className={`${inputCls} mt-1 min-h-[96px]`}
                    placeholder="用一句话概括要达成的目标"
                  />
                </div>

                <div>
                  <div className="flex items-start justify-between gap-2">
                    <label htmlFor="obj-bg" className={labelCls}>
                      背景 / 价值 <span className="text-[var(--goalops-danger)]">*</span>
                    </label>
                    <FormCharHint cur={charCount(form.background)} max={500} />
                  </div>
                  <textarea
                    id="obj-bg"
                    value={form.background}
                    onChange={(e) => patch('background', e.target.value.slice(0, 800))}
                    maxLength={500}
                    className={`${inputCls} mt-1 min-h-[96px] resize-y`}
                    placeholder="为什么要做这个目标？能解决什么问题？创造什么价值？"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <label htmlFor="obj-sc" className={labelCls}>
                      成功标准 <span className="text-[var(--goalops-danger)]">*</span>
                    </label>
                    <FormCharHint cur={charCount(form.success_criteria)} max={500} />
                  </div>
                  <textarea
                    id="obj-sc"
                    value={form.success_criteria}
                    onChange={(e) => patch('success_criteria', e.target.value.slice(0, 800))}
                    maxLength={500}
                    className={`${inputCls} mt-1 min-h-[96px] resize-y`}
                    placeholder="如何判断目标成功？需满足哪些可量化或可验证的标准？"
                    rows={3}
                  />
                </div>

                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-1.5">
                      <label htmlFor="obj-oos" className={labelCls}>
                        不属于本目标范围
                      </label>
                      <span
                        className="mt-0.5 shrink-0 text-[var(--goalops-text-subtle)]"
                        title="明确范围外事项，避免范围蔓延"
                      >
                        <AlertCircle className="size-4" aria-hidden />
                      </span>
                    </div>
                    <FormCharHint cur={charCount(form.out_of_scope)} max={300} />
                  </div>
                  <textarea
                    id="obj-oos"
                    value={form.out_of_scope}
                    onChange={(e) => patch('out_of_scope', e.target.value.slice(0, 500))}
                    maxLength={300}
                    className={`${inputCls} mt-1 min-h-[96px] resize-y`}
                    placeholder="明确本目标不包含的事项，避免范围扩大"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="2 状态与排期" compact>
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="lg:col-span-1">
                <label htmlFor="obj-priority" className={labelCls}>
                  优先级 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="obj-priority"
                  value={form.priority}
                  onChange={(e) => patch('priority', e.target.value)}
                  className={`${selectCls} mt-1`}
                  required
                  disabled={!selectOptions}
                >
                  {!selectOptions ? (
                    <option value="">加载选项中…</option>
                  ) : (
                    selectOptions.priorities.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div className="lg:col-span-1">
                <label htmlFor="obj-status" className={labelCls}>
                  状态 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="obj-status"
                  value={form.status}
                  onChange={(e) => patch('status', e.target.value)}
                  className={`${selectCls} mt-1`}
                  required
                  disabled={!selectOptions}
                >
                  {!selectOptions ? (
                    <option value="">加载选项中…</option>
                  ) : (
                    selectOptions.statuses.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="lg:col-span-2">
                <fieldset>
                  <legend className={`${labelCls}`}>
                    起止时间 <span className="text-[var(--goalops-danger)]">*</span>
                  </legend>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[140px] flex-1">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--goalops-text-subtle)]" />
                      <input
                        id="obj-start"
                        type="date"
                        value={form.start_date}
                        onChange={(e) => patch('start_date', e.target.value)}
                        className={`${inputCls} pl-10`}
                        aria-label="开始日期"
                      />
                    </div>
                    <span className="text-[var(--goalops-text-subtle)]" aria-hidden>
                      —
                    </span>
                    <div className="relative min-w-[140px] flex-1">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--goalops-text-subtle)]" />
                      <input
                        id="obj-due"
                        type="date"
                        value={form.due_date}
                        onChange={(e) => patch('due_date', e.target.value)}
                        className={`${inputCls} pl-10`}
                        aria-label="结束日期"
                      />
                    </div>
                  </div>
                </fieldset>
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="obj-owner" className={labelCls}>
                  负责人 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="obj-owner"
                  value={form.owner}
                  onChange={(e) => patch('owner', e.target.value)}
                  className={`${selectCls} mt-1 max-w-md`}
                  required
                  disabled={membersLoading || !hasMembers}
                >
                  <option value="">{membersLoading ? '加载中…' : hasMembers ? '请选择成员' : '暂无成员'}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <div className={labelCls}>参与成员</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {form.participant_ids.map((id, idx) => {
                    const m = members.find((x) => x.id === id)
                    const label = m?.name ?? id
                    const ini = initialsFromName(label)
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--goalops-border)] bg-slate-50/80 py-0.5 pl-0.5 pr-1.5 text-[13px]"
                      >
                        <span
                          className="flex size-7 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: chipColor(idx) }}
                        >
                          {ini}
                        </span>
                        <span className="max-w-[140px] truncate text-[var(--goalops-text)]">{label}</span>
                        <button
                          type="button"
                          className="rounded-md px-1 text-[var(--goalops-text-subtle)] hover:bg-slate-200 hover:text-[var(--goalops-text)]"
                          aria-label={`移除 ${label}`}
                          onClick={() =>
                            patch(
                              'participant_ids',
                              form.participant_ids.filter((x) => x !== id),
                            )
                          }
                        >
                          ×
                        </button>
                      </span>
                    )
                  })}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setParticipantPickerOpen((o) => !o)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-2.5 py-1.5 text-[13px] font-medium text-[var(--goalops-primary)] hover:bg-slate-50"
                    >
                      + 添加成员
                      <ChevronDown className={`size-4 transition ${participantPickerOpen ? 'rotate-180' : ''}`} aria-hidden />
                    </button>
                    {participantPickerOpen ? (
                      <div className="absolute left-0 z-20 mt-1.5 max-h-48 min-w-[200px] overflow-auto rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-1.5 text-[13px] shadow-lg">
                        {availableToAddParticipants.length === 0 ? (
                          <p className="px-2 py-2 text-[11px] text-[var(--goalops-text-muted)]">暂无可添加成员</p>
                        ) : (
                          availableToAddParticipants.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-slate-100"
                              onClick={() => {
                                patch('participant_ids', [...form.participant_ids, m.id])
                                setParticipantPickerOpen(false)
                              }}
                            >
                              <span
                                className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                                style={{
                                  backgroundColor: chipColor(
                                    [...form.participant_ids, m.id].length,
                                  ),
                                }}
                              >
                                {initialsFromName(m.name)}
                              </span>
                              <span className="truncate">{m.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 border-t border-[var(--goalops-border)] pt-4">
                <div className={labelCls}>
                  风险等级 <span className="text-[var(--goalops-danger)]">*</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="风险等级">
                  {(
                    [
                      { key: 'low', label: '低', cls: 'border-emerald-500/70 bg-emerald-50 text-emerald-900' },
                      { key: 'medium', label: '中', cls: 'border-amber-500/70 bg-amber-50 text-amber-950' },
                      { key: 'high', label: '高', cls: 'border-rose-500/70 bg-rose-50 text-rose-900' },
                    ] as const
                  ).map((opt) => {
                    const active = form.risk_level === opt.key
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => patch('risk_level', opt.key)}
                        className={`rounded-lg border px-3.5 py-1.5 text-[13px] font-semibold transition hover:opacity-95 ${
                          active ? `${opt.cls} ring-2 ring-offset-2 ring-slate-900/10` : 'border-[var(--goalops-border)] bg-[var(--goalops-surface)] text-[var(--goalops-text-muted)] hover:bg-slate-50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="3 成果" compact>
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
                <div className="flex h-full min-h-0 flex-col">
                  <label htmlFor="obj-deliverables" className={labelCls}>
                    核心交付件
                  </label>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--goalops-text-subtle)]">
                    每行一条，将作为项目符号列表保存（空行自动忽略）。
                  </p>
                  <textarea
                    id="obj-deliverables"
                    value={form.deliverables_bullets}
                    onChange={(e) => patch('deliverables_bullets', e.target.value)}
                    className={`${inputCls} mt-1.5 min-h-[128px] flex-1 resize-y`}
                    placeholder={`例如：\n完成需求评审与排期\n交付可灰度发布的版本`}
                    rows={5}
                  />
                  {deliverablePreviewLines.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[12px] leading-snug text-[var(--goalops-text-muted)]">
                      {deliverablePreviewLines.map((line, i) => (
                        <li key={`${i}-${line.slice(0, 8)}`}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={labelCls}>核心文档（外链）</span>
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-[var(--goalops-primary)] hover:underline"
                      onClick={() =>
                        patch('core_document_links', [...form.core_document_links, { title: '', url: '' }])
                      }
                    >
                      + 添加外链
                    </button>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--goalops-text-subtle)]">
                    填写名称与可访问 URL（飞书文档、Notion、Wiki 等），无需上传文件。
                  </p>
                  {form.core_document_links.length === 0 ? (
                    <div
                      className={`mt-1.5 flex min-h-[128px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-[var(--goalops-border)] bg-slate-50/60 px-3 text-center text-[12px] text-[var(--goalops-text-subtle)]`}
                    >
                      暂无文档链接
                    </div>
                  ) : (
                    <ul className="mt-1.5 min-h-[128px] flex-1 space-y-2">
                      {form.core_document_links.map((row, i) => (
                        <li
                          key={i}
                          className="rounded-lg border border-[var(--goalops-border)] bg-slate-50/40 p-2.5"
                        >
                          <div className="mb-2">
                            <label className={`${labelCls} text-[11px]`} htmlFor={`doc-title-${i}`}>
                              文档名称
                            </label>
                            <input
                              id={`doc-title-${i}`}
                              type="text"
                              value={row.title}
                              onChange={(e) => {
                                const next = [...form.core_document_links]
                                next[i] = { ...next[i]!, title: e.target.value }
                                patch('core_document_links', next)
                              }}
                              placeholder="例如：PRD / 技术方案"
                              className={`${inputCls} mt-1`}
                            />
                          </div>
                          <div>
                            <label className={`${labelCls} text-[11px]`} htmlFor={`doc-url-${i}`}>
                              链接
                            </label>
                            <input
                              id={`doc-url-${i}`}
                              type="url"
                              inputMode="url"
                              autoComplete="off"
                              value={row.url}
                              onChange={(e) => {
                                const next = [...form.core_document_links]
                                next[i] = { ...next[i]!, url: e.target.value }
                                patch('core_document_links', next)
                              }}
                              placeholder="https://..."
                              className={`${inputCls} mt-1`}
                            />
                          </div>
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              className="text-[12px] text-[var(--goalops-danger)] hover:underline"
                              onClick={() =>
                                patch(
                                  'core_document_links',
                                  form.core_document_links.filter((_, idx) => idx !== i),
                                )
                              }
                            >
                              移除此条
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {submitError ? (
            <p
              className="rounded-lg border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger)]/10 px-3 py-2 text-[13px] text-[var(--goalops-danger)]"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pb-6 xl:hidden">
            <button
              type="button"
              onClick={persistDraftLocally}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-[13px] font-semibold shadow-sm hover:bg-slate-50"
            >
              保存草稿
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="inline-flex flex-[2] items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-[13px] font-semibold text-white hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? '创建中…' : '创建目标'}
            </button>
          </div>
        </form>

        <aside className="space-y-3 xl:sticky xl:top-24 xl:block xl:self-start">
          <div className="space-y-2 rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-4 shadow-[var(--goalops-shadow-card)]">
            <h3 className="text-[13px] font-semibold text-[var(--goalops-text)]">创建说明 / 填写提示</h3>
            <ul className="space-y-2 text-[12px] leading-snug text-[var(--goalops-text-muted)]">
              <li className="flex gap-1.5">
                <Lightbulb className="size-3.5 shrink-0 text-amber-500" aria-hidden />
                <span>目标名称建议使用「动词 + 结果」结构，尽量避免模糊用词。</span>
              </li>
              <li className="flex gap-1.5">
                <TrendingUp className="size-3.5 shrink-0 text-sky-500" aria-hidden />
                <span>背景与价值要写清业务动因：用户、痛点、量化收益。</span>
              </li>
              <li className="flex gap-1.5">
                <Target className="size-3.5 shrink-0 text-rose-500" aria-hidden />
                <span>成功标准应尽量可度量；拆成条目（每行一条）便于对齐验收。</span>
              </li>
              <li className="flex gap-1.5">
                <UsersIcon className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                <span>负责人与参与成员要区分：负责人担责，参与成员协同。</span>
              </li>
              <li className="flex gap-1.5">
                <ClipboardList className="size-3.5 shrink-0 text-violet-500" aria-hidden />
                <span>交付件可逐行填写；核心文档请粘贴外链，无需上传附件。</span>
              </li>
            </ul>
          </div>

          <div className="rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] shadow-[var(--goalops-shadow-card)]">
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--goalops-text)]"
              aria-expanded={previewOpen}
            >
              实时预览摘要
              <span className="text-[11px] font-normal text-[var(--goalops-primary)]">{previewOpen ? '收起' : '展开'}</span>
            </button>
            {previewOpen ? (
              <div className="border-t border-[var(--goalops-border)] px-4 py-3 text-[12px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <FileText className="size-3.5 text-[var(--goalops-text-subtle)]" aria-hidden />
                  <span className="truncate font-semibold text-[var(--goalops-text)]">
                    {form.name.trim() || '未命名目标'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.priority ? (
                    <StatusPill tone={priorityPillTone(form.priority)}>{form.priority}</StatusPill>
                  ) : null}
                  {form.status ? (
                    <StatusPill tone={objectiveRecordStatusTone(form.status)}>
                      {objectiveStatusLabel(form.status)}
                    </StatusPill>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-1.5 text-[12px] text-[var(--goalops-text-muted)]">
                  <div className="flex justify-between gap-2 border-b border-dashed border-[var(--goalops-border)] pb-1.5">
                    <span>负责人</span>
                    <span className="truncate font-medium text-[var(--goalops-text)]">
                      {ownerResolvedName || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-b border-dashed border-[var(--goalops-border)] pb-1.5">
                    <span>起止</span>
                    <span className="font-medium tabular-nums text-[var(--goalops-text)]">
                      {formatDotDate(form.start_date)} — {formatDotDate(form.due_date)}
                    </span>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span>进度</span>
                      <span className="font-semibold tabular-nums">{previewProgress}%</span>
                    </div>
                    <ProgressBar value={previewProgress} />
                  </div>
                </div>
                {participantNames.length > 0 ? (
                  <div className="mt-3">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--goalops-text-subtle)]">
                      参与成员
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {participantNames.map((n, idx) => (
                        <span
                          key={`${n}-${idx}`}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--goalops-border)] bg-slate-50/90 px-1.5 py-0.5 text-[11px]"
                          title={n}
                        >
                          <span
                            className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                            style={{ backgroundColor: chipColor(idx + 3) }}
                          >
                            {initialsFromName(n)}
                          </span>
                          <span className="max-w-[100px] truncate">{n}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-[var(--goalops-radius-card)] border border-[var(--goalops-border)] bg-[var(--goalops-surface)] p-4 shadow-[var(--goalops-shadow-card)]">
            <h3 className="text-center text-[13px] font-semibold text-[var(--goalops-text)]">填写完成度</h3>
            <CompletionDonut value={completion.overall} />
            <div className="space-y-2">
              <SectionProgressRow
                tone="bg-[var(--goalops-danger)]"
                label="基本信息"
                fraction={`${completion.s1}/${completion.max1}`}
              />
              <SectionProgressRow
                tone="bg-amber-500"
                label="状态与排期"
                fraction={`${completion.s2}/${completion.max2}`}
              />
              <SectionProgressRow
                tone="bg-slate-300"
                label="成果"
                fraction={`${completion.s3}/${completion.max3}`}
              />
            </div>
            <p className="text-center text-[12px] text-[var(--goalops-text-subtle)]">请完善必填项以创建目标</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
