import type { RecordModel } from 'pocketbase'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SectionCard } from '@/components'
import {
  createObjective,
  fetchKeyResultsForObjective,
  fetchObjectiveOwnerOptions,
  fetchObjectiveStatusPriorityOptions,
  keyResultRecordsToFormRows,
  newKeyResultFormRow,
  OBJECTIVE_PRIORITY_VALUES,
  OBJECTIVE_STATUS_VALUES,
  objectiveDraftToCreateInput,
  objectiveRecordToFormDraft,
  type KeyResultFormRow,
  updateObjective,
  type ObjectiveFormDraftFields,
  type ObjectiveOwnerOption,
  type ObjectiveSelectOption,
} from '@/features/objectives/createObjective'
import { ObjectiveFormScaffold } from '@/features/objectives/ObjectiveFormScaffold'
import {
  ObjectiveDangerBanner,
  ObjectiveDraftStatusPills,
  ObjectiveFormActionsFooter,
  ObjectiveFormMetricsPreview,
  ObjectiveHeaderOutlineLink,
  ObjectiveHeaderSubmitButton,
} from '@/features/objectives/objectiveFormUi'
import {
  objectiveFormInputCls as inputCls,
  objectiveFormLabelCls as labelCls,
  objectiveFormSelectCls as selectCls,
} from '@/features/objectives/objectiveFormTokens'
import { coerceObjectiveStatusForWrite, editorToPlainText, objectiveStatusLabel } from '@/features/objectives/objectiveDetailUtils'
import { krCompletionFromRows } from '@/features/objectives/keyResults'
import { pb } from '@/services/pocketbase'

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

function ensureOptionList(
  opts: ObjectiveSelectOption[],
  current: string,
  kind: 'status' | 'priority',
): ObjectiveSelectOption[] {
  const v = current.trim()
  if (!v || opts.some((o) => o.value === v)) return opts
  const label = kind === 'status' ? objectiveStatusLabel(v) : v
  return [...opts, { value: v, label }]
}

function pickDefaultStatus(statuses: ObjectiveSelectOption[]): string {
  const prefers = ['not_started', '未开始']
  for (const v of prefers) {
    const hit = statuses.find((o) => o.value === v)
    if (hit) return hit.value
  }
  return statuses.find((o) => o.value === 'in_progress')?.value ?? statuses[0]?.value ?? ''
}

const emptyDraft: ObjectiveFormDraftFields = {
  name: '',
  owner: '',
  status: '',
  priority: 'P1',
  definition: '',
  success_criteria: '',
  out_of_scope: '',
  start_date: '',
  due_date: '',
  progress_percent: '0',
  participant_ids: [],
  risk_level: '',
  current_blockers_summary: '',
  action_suggestions_text: '',
  draft_deliverables: [],
  draft_core_documents: [],
  key_results: [newKeyResultFormRow()],
}

const FORM_ID = 'goal-form-page'

/**
 * `/objectives/new` 创建与 `/objectives/:id/edit` 编辑共用。
 */
export function GoalFormPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = useParams<{ id?: string }>()
  const isCreate = location.pathname.endsWith('/objectives/new')
  const objectiveId = isCreate ? undefined : params.id

  const [members, setMembers] = useState<ObjectiveOwnerOption[]>([])
  const [membersError, setMembersError] = useState<string | null>(null)
  const [membersLoading, setMembersLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [recordLoading, setRecordLoading] = useState(!isCreate)
  const [form, setForm] = useState<ObjectiveFormDraftFields>(() => ({
    ...emptyDraft,
    key_results: [newKeyResultFormRow()],
  }))
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectOptions, setSelectOptions] = useState<{
    statuses: ObjectiveSelectOption[]
    priorities: ObjectiveSelectOption[]
  } | null>(isCreate ? null : null)

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
    const timer = window.setTimeout(() => {
      void loadMembers()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMembers])

  /* 创建模式：下拉选项 */
  useEffect(() => {
    if (!isCreate) return
    let cancelled = false
    void (async () => {
      try {
        const opts = await fetchObjectiveStatusPriorityOptions().catch(() => fallbackSelectOptions())
        if (cancelled) return
        const statuses = opts.statuses
        const priorities = opts.priorities
        const defaultSt = statuses.some((x) => x.value === 'in_progress')
          ? 'in_progress'
          : pickDefaultStatus(statuses)
        const defaultPri = priorities.some((x) => x.value === 'P1') ? 'P1' : priorities[0]?.value ?? 'P1'
        setSelectOptions(opts)
        setForm((f) => ({
          ...f,
          status: f.status.trim() ? coerceObjectiveStatusForWrite(f.status) : defaultSt,
          priority: f.priority.trim() ? f.priority : defaultPri,
        }))
      } catch {
        const fb = fallbackSelectOptions()
        if (cancelled) return
        setSelectOptions(fb)
        setForm((f) => ({
          ...f,
          status: f.status.trim() ? coerceObjectiveStatusForWrite(f.status) : pickDefaultStatus(fb.statuses),
          priority: f.priority.trim() ? f.priority : 'P1',
        }))
      } finally {
        if (!cancelled) setRecordLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isCreate])

  /* 编辑模式：目标 + KR */
  useEffect(() => {
    if (isCreate || !objectiveId) return
    let cancelled = false
    void (async () => {
      setRecordLoading(true)
      setLoadError(null)
      try {
        const [rec, opts, krList] = await Promise.all([
          pb.collection('objectives').getOne(objectiveId, { expand: 'owner' }),
          fetchObjectiveStatusPriorityOptions().catch(() => fallbackSelectOptions()),
          fetchKeyResultsForObjective(objectiveId).catch(() => [] as RecordModel[]),
        ])
        if (cancelled) return
        const draft = objectiveRecordToFormDraft(rec)
        const statuses = ensureOptionList(opts.statuses, draft.status, 'status')
        const priorities = ensureOptionList(opts.priorities, draft.priority, 'priority')
        setSelectOptions({ statuses, priorities })
        const krRows = krList.length > 0 ? keyResultRecordsToFormRows(krList) : [newKeyResultFormRow()]
        setForm({ ...draft, key_results: krRows })
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e))
          setSelectOptions(fallbackSelectOptions())
        }
      } finally {
        if (!cancelled) setRecordLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isCreate, objectiveId])

  const hasMembers = members.length > 0
  const enumsReady =
    !!selectOptions &&
    selectOptions.statuses.length > 0 &&
    selectOptions.priorities.length > 0 &&
    !!form.status &&
    !!form.priority

  const pageBusy = isCreate ? !selectOptions : recordLoading || !selectOptions

  const validate = useCallback((): string | null => {
    if (!form.name.trim()) return '请填写目标名称'
    if (!form.owner.trim()) return '请选择负责人'
    if (!form.status.trim()) return '请选择状态'
    if (!form.priority.trim()) return '请选择优先级'
    const p = form.progress_percent.trim()
    if (p !== '') {
      const n = Number(p)
      if (Number.isNaN(n) || n < 0 || n > 100) return '进度需在 0–100 之间'
    }
    const s = form.start_date.trim()
    const d = form.due_date.trim()
    if (s && d && s > d) return '开始日期不能晚于截止日期'
    if (isCreate) {
      if (!form.definition.trim()) return '请填写目标描述'
    }
    return null
  }, [form, isCreate])

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
      const input = objectiveDraftToCreateInput(form)
      if (isCreate) {
        const meta = await createObjective(input)
        navigate(`/objectives/${meta.id}`, {
          replace: false,
          state: { objectiveUpdated: true },
        })
      } else if (objectiveId) {
        await updateObjective(objectiveId, input)
        navigate(`/objectives/${objectiveId}`, {
          replace: false,
          state: { objectiveUpdated: true },
        })
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  function patch<K extends keyof ObjectiveFormDraftFields>(key: K, value: ObjectiveFormDraftFields[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function patchKr(index: number, partial: Partial<KeyResultFormRow>) {
    setForm((f) => {
      const next = [...f.key_results]
      const cur = next[index]
      if (!cur) return f
      next[index] = { ...cur, ...partial }
      return { ...f, key_results: next }
    })
  }

  function addKr() {
    setForm((f) => ({
      ...f,
      key_results: [...f.key_results, newKeyResultFormRow({ sort_order: f.key_results.length })],
    }))
  }

  function removeKr(index: number) {
    setForm((f) => ({
      ...f,
      key_results: f.key_results.filter((_, i) => i !== index),
    }))
  }

  const krAgg = krCompletionFromRows(form.key_results.map((k) => ({ name: k.name, is_completed: k.is_completed })))

  const krHintText = useMemo(() => {
    if (krAgg.percent === null) return '暂无关键结果 · 建议在保存前添加至少 1 条 Checkbox KR'
    return `${krAgg.completed} / ${krAgg.total} 已完成 · KR 完成率用于写入目标进度`
  }, [krAgg])

  if (!isCreate && !objectiveId) {
    return (
      <p className="text-sm text-[var(--goalops-warning)]" role="alert">
        路由缺少目标 ID。
      </p>
    )
  }

  const ownerResolvedName = members.find((m) => m.id === form.owner)?.name ?? ''
  const progressParsed = Number(form.progress_percent.trim())
  const manualPreview = Number.isNaN(progressParsed) ? 0 : progressParsed
  const previewProgress = krAgg.percent !== null ? krAgg.percent : manualPreview

  const defPlain = editorToPlainText(form.definition.trim())
  const titleText =
    form.name.trim() ? form.name.trim() : isCreate ? '创建目标' : '编辑目标'

  const descriptionBlock: ReactNode = (
    <>
      {!pageBusy && !loadError ? (
        defPlain ? (
          <span className="block max-h-24 overflow-hidden whitespace-pre-wrap">{defPlain}</span>
        ) : (
          <>目标描述填写在下方；将进入详情页正文区。</>
        )
      ) : loadError ? (
        <>无法在表单中载入该目标的当前字段，请先处理上方错误信息后重试。</>
      ) : (
        <>正在同步 PocketBase …</>
      )}
    </>
  )

  const banners: ReactNode = (
    <>
      {loadError ? (
        <ObjectiveDangerBanner
          title="无法加载目标"
          details={loadError}
          action={
            <Link to="/objectives" className="text-sm font-semibold text-[var(--goalops-primary)] hover:underline">
              返回目标列表
            </Link>
          }
        />
      ) : null}
      {membersError ? (
        <ObjectiveDangerBanner
          title="无法加载负责人列表"
          details={membersError}
          action={
            <button
              type="button"
              onClick={() => void loadMembers()}
              className="text-sm font-semibold text-[var(--goalops-primary)] hover:underline"
            >
              重试
            </button>
          }
        />
      ) : null}
    </>
  )

  const metrics: ReactNode = loadError && !isCreate ? null : pageBusy ? (
    <div
      className="rounded-[var(--goalops-radius-card)] border border-dashed border-[var(--goalops-border)] bg-slate-50/50 px-5 py-10 text-center text-sm text-[var(--goalops-text-muted)] shadow-[var(--goalops-shadow-card)]"
      role="status"
    >
      {isCreate ? '正在加载下拉选项…' : '正在加载草稿预览所需的字段…'}
    </div>
  ) : (
    <div className="space-y-2">
      <p className="text-xs text-[var(--goalops-text-muted)]">{krHintText}</p>
      <ObjectiveFormMetricsPreview
        progressFraction={previewProgress}
        ownerDisplayName={ownerResolvedName}
        ownerSub=""
        startIso={form.start_date}
        dueIso={form.due_date}
      />
    </div>
  )

  const submitDisabled =
    submitting || membersLoading || !hasMembers || !enumsReady || pageBusy || (!isCreate && !!loadError)

  const cancelHref = isCreate ? '/objectives' : `/objectives/${objectiveId}`

  return (
    <ObjectiveFormScaffold
      banners={banners}
      titleRow={
        <>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--goalops-text)] md:text-2xl">{titleText}</h1>
          <ObjectiveDraftStatusPills statusValue={form.status} priorityValue={form.priority} />
        </>
      }
      description={descriptionBlock}
      metaLines={
        <>
          {!isCreate && objectiveId ? (
            <span>
              目标记录 ID:{' '}
              <span className="font-medium text-[var(--goalops-text-muted)]">{objectiveId}</span>
            </span>
          ) : (
            <span className="font-medium text-[var(--goalops-text-muted)]">创建模式 · Key Result Checkbox</span>
          )}
          {!loadError && !pageBusy ? (
            <span>
              PocketBase · <span className="font-medium text-[var(--goalops-text-muted)]">KR 进度优先</span>
            </span>
          ) : null}
        </>
      }
      headerActionsRight={
        <>
          <ObjectiveHeaderOutlineLink to="/objectives">
            <>
              <ArrowLeft className="size-4 text-[var(--goalops-text-muted)]" aria-hidden />
              返回目标列表
            </>
          </ObjectiveHeaderOutlineLink>
          {!isCreate && objectiveId ? (
            <ObjectiveHeaderOutlineLink to={`/objectives/${objectiveId}`}>返回目标详情</ObjectiveHeaderOutlineLink>
          ) : null}
          <ObjectiveHeaderSubmitButton
            formId={FORM_ID}
            label={isCreate ? '创建目标' : '保存更改'}
            busyLabel={isCreate ? '创建中…' : '保存中…'}
            submitting={submitting}
            disabled={submitDisabled}
          />
        </>
      }
      metrics={metrics}
    >
      {!loadError || isCreate ? (
        <form id={FORM_ID} onSubmit={onSubmit} className="space-y-6">
          <SectionCard title="基本信息">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="goal-obj-name" className={labelCls}>
                  目标名称 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <input
                  id="goal-obj-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => patch('name', e.target.value)}
                  className={`${inputCls} mt-1.5`}
                  autoComplete="off"
                  required
                  disabled={pageBusy}
                />
              </div>
              <div>
                <label htmlFor="goal-owner" className={labelCls}>
                  负责人 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="goal-owner"
                  value={form.owner}
                  onChange={(e) => patch('owner', e.target.value)}
                  className={`${selectCls} mt-1.5`}
                  required
                  disabled={membersLoading || !hasMembers || pageBusy}
                >
                  <option value="">{membersLoading ? '加载中…' : hasMembers ? '请选择成员' : '暂无成员'}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="goal-status" className={labelCls}>
                  状态 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="goal-status"
                  value={form.status}
                  onChange={(e) => patch('status', e.target.value)}
                  className={`${selectCls} mt-1.5`}
                  required
                  disabled={!selectOptions || pageBusy}
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
              <div className="sm:col-span-2 sm:max-w-md">
                <label htmlFor="goal-priority" className={labelCls}>
                  优先级 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="goal-priority"
                  value={form.priority}
                  onChange={(e) => patch('priority', e.target.value)}
                  className={`${selectCls} mt-1.5`}
                  required
                  disabled={!selectOptions || pageBusy}
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
            </div>
          </SectionCard>

          <SectionCard title="关键结果（Checkbox）">
            <p className="mb-4 text-sm text-[var(--goalops-text-muted)]">{krHintText}</p>
            <div className="space-y-4">
              {form.key_results.map((kr, idx) => (
                <div
                  key={kr.tempId}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--goalops-border)] bg-slate-50/40 p-4 lg:flex-row lg:items-start"
                >
                  <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-[var(--goalops-text)]">
                    <input
                      type="checkbox"
                      checked={kr.is_completed}
                      onChange={(e) => patchKr(idx, { is_completed: e.target.checked })}
                      className="size-4 rounded border-[var(--goalops-border)]"
                      disabled={pageBusy}
                    />
                    完成
                  </label>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input
                      type="text"
                      value={kr.name}
                      onChange={(e) => patchKr(idx, { name: e.target.value })}
                      className={`${inputCls}`}
                      placeholder="关键结果描述"
                      disabled={pageBusy}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <span className={labelCls}>KR 负责人（可选）</span>
                        <select
                          value={kr.owner_id}
                          onChange={(e) => patchKr(idx, { owner_id: e.target.value })}
                          className={`${selectCls} mt-1.5`}
                          disabled={membersLoading || pageBusy}
                        >
                          <option value="">—</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className={labelCls}>备注</span>
                        <input
                          type="text"
                          value={kr.note}
                          onChange={(e) => patchKr(idx, { note: e.target.value })}
                          className={`${inputCls} mt-1.5`}
                          disabled={pageBusy}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeKr(idx)}
                    className="shrink-0 text-sm font-medium text-[var(--goalops-danger)] hover:underline"
                    disabled={pageBusy || form.key_results.length <= 1}
                  >
                    移除
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void addKr()}
                className="text-sm font-semibold text-[var(--goalops-primary)] hover:underline"
                disabled={pageBusy || form.key_results.length >= 8}
              >
                + 添加关键结果（最多 8 条）
              </button>
            </div>
          </SectionCard>

          <SectionCard title="时间与进度">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="goal-start" className={labelCls}>
                  开始日期
                </label>
                <input
                  id="goal-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => patch('start_date', e.target.value)}
                  className={`${inputCls} mt-1.5`}
                  disabled={pageBusy}
                />
              </div>
              <div>
                <label htmlFor="goal-due" className={labelCls}>
                  截止日期
                </label>
                <input
                  id="goal-due"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => patch('due_date', e.target.value)}
                  className={`${inputCls} mt-1.5`}
                  disabled={pageBusy}
                />
              </div>
              <div className="sm:col-span-2 sm:max-w-xs">
                <label htmlFor="goal-progress" className={labelCls}>
                  手动进度（%）
                </label>
                <input
                  id="goal-progress"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.progress_percent}
                  onChange={(e) => patch('progress_percent', e.target.value)}
                  className={`${inputCls} mt-1.5 tabular-nums`}
                  disabled={pageBusy}
                />
                <p className="mt-2 text-xs text-[var(--goalops-text-subtle)]">
                  当有已命名的 KR 时，保存后进度将以 KR 勾选完成率为准并覆盖此项。
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="目标描述">
            <label htmlFor="goal-definition" className={labelCls}>
              目标描述 {isCreate ? <span className="text-[var(--goalops-danger)]">*</span> : null}
            </label>
            <textarea
              id="goal-definition"
              value={form.definition}
              onChange={(e) => patch('definition', e.target.value)}
              className={`${inputCls} mt-1.5 min-h-[180px] resize-y`}
              rows={8}
              placeholder="一句话概括目标，再补充背景与价值（同步到 objectives.definition）"
              disabled={pageBusy}
            />
          </SectionCard>

          <SectionCard title="范围">
            <label htmlFor="goal-oos" className={labelCls}>
              范围外条目（每行一条）
            </label>
            <textarea
              id="goal-oos"
              value={form.out_of_scope}
              onChange={(e) => patch('out_of_scope', e.target.value)}
              className={`${inputCls} mt-1.5 min-h-[120px] resize-y`}
              rows={4}
              disabled={pageBusy}
            />
          </SectionCard>

          <SectionCard title="当前风险与下一步">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="goal-risk" className={labelCls}>
                  当前风险
                </label>
                <textarea
                  id="goal-risk"
                  value={form.current_blockers_summary}
                  onChange={(e) => patch('current_blockers_summary', e.target.value)}
                  className={`${inputCls} mt-1.5 min-h-[100px] resize-y`}
                  rows={4}
                  disabled={pageBusy}
                />
              </div>
              <div>
                <label htmlFor="goal-next" className={labelCls}>
                  下一步行动（每行一条建议）
                </label>
                <textarea
                  id="goal-next"
                  value={form.action_suggestions_text}
                  onChange={(e) => patch('action_suggestions_text', e.target.value)}
                  className={`${inputCls} mt-1.5 min-h-[100px] resize-y`}
                  rows={4}
                  disabled={pageBusy}
                />
              </div>
            </div>
          </SectionCard>

          {submitError ? (
            <p
              className="rounded-xl border border-[var(--goalops-danger)]/30 bg-[var(--goalops-danger)]/10 px-4 py-3 text-sm text-[var(--goalops-danger)]"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}

          <ObjectiveFormActionsFooter
            submitLabel={isCreate ? '创建目标' : '保存更改'}
            busySubmitLabel={isCreate ? '创建中…' : '保存中…'}
            submitting={submitting}
            submitDisabled={submitDisabled}
            cancelHref={cancelHref}
            cancelLabel="取消"
          />
        </form>
      ) : null}
    </ObjectiveFormScaffold>
  )
}
