import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { SectionCard } from '@/components'
import {
  fetchObjectiveOwnerOptions,
  fetchObjectiveStatusPriorityOptions,
  OBJECTIVE_PRIORITY_VALUES,
  OBJECTIVE_STATUS_VALUES,
  objectiveDraftToCreateInput,
  objectiveRecordToFormDraft,
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
import { objectiveStatusLabel, editorToPlainText } from '@/features/objectives/objectiveDetailUtils'
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
  const label =
    kind === 'status' ? objectiveStatusLabel(v) : v
  return [...opts, { value: v, label }]
}

const emptyDraft: ObjectiveFormDraftFields = {
  name: '',
  owner: '',
  status: '',
  priority: '',
  definition: '',
  one_sentence_definition: '',
  background: '',
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
}

const FORM_ID = 'objective-edit-form'

export function ObjectiveEditPage() {
  const { id: objectiveId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [members, setMembers] = useState<ObjectiveOwnerOption[]>([])
  const [membersError, setMembersError] = useState<string | null>(null)
  const [membersLoading, setMembersLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [recordLoading, setRecordLoading] = useState(true)
  const [form, setForm] = useState<ObjectiveFormDraftFields>(emptyDraft)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
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
    const id = window.setTimeout(() => {
      void loadMembers()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadMembers])

  useEffect(() => {
    if (!objectiveId) return
    let cancelled = false
    void (async () => {
      setRecordLoading(true)
      setLoadError(null)
      try {
        const [rec, opts] = await Promise.all([
          pb.collection('objectives').getOne(objectiveId, { expand: 'owner' }),
          fetchObjectiveStatusPriorityOptions().catch(() => fallbackSelectOptions()),
        ])
        if (cancelled) return
        const draft = objectiveRecordToFormDraft(rec)
        const statuses = ensureOptionList(opts.statuses, draft.status, 'status')
        const priorities = ensureOptionList(opts.priorities, draft.priority, 'priority')
        setSelectOptions({ statuses, priorities })
        setForm({ ...draft })
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
  }, [objectiveId])

  const hasMembers = members.length > 0
  const enumsReady =
    !!selectOptions &&
    selectOptions.statuses.length > 0 &&
    selectOptions.priorities.length > 0 &&
    !!form.status &&
    !!form.priority

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
    return null
  }, [form])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!objectiveId) return
    setSubmitError(null)
    const v = validate()
    if (v) {
      setSubmitError(v)
      return
    }
    setSubmitting(true)
    try {
      const input = objectiveDraftToCreateInput(form)
      await updateObjective(objectiveId, input)
      navigate(`/objectives/${objectiveId}`, {
        replace: false,
        state: { objectiveUpdated: true },
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  function patch<K extends keyof ObjectiveFormDraftFields>(key: K, value: ObjectiveFormDraftFields[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  if (!objectiveId) {
    return (
      <p className="text-sm text-[var(--goalops-warning)]" role="alert">
        路由缺少目标 ID。
      </p>
    )
  }

  const pageBusy = recordLoading || !selectOptions
  const ownerResolvedName = members.find((m) => m.id === form.owner)?.name ?? ''
  const progressParsed = Number(form.progress_percent.trim())
  const previewProgress = Number.isNaN(progressParsed) ? 0 : progressParsed
  const defPlain = editorToPlainText(form.definition.trim())
  const titleText = form.name.trim() ? form.name.trim() : '编辑目标'

  const descriptionBlock: ReactNode = (
    <>
      {!pageBusy && !loadError ? (
        defPlain ? (
          <span className="block max-h-24 overflow-hidden whitespace-pre-wrap">{defPlain}</span>
        ) : (
          <>补充定义有助于在详情摘要区展示一致上下文；纯文本也会被保存为编辑器字段。</>
        )
      ) : loadError ? (
        <>无法在表单中载入该目标的当前字段，请先处理上方错误信息后重试。</>
      ) : (
        <>正在同步 PocketBase 中的目标快照与下拉选项……</>
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

  const metrics: ReactNode = loadError ? null : pageBusy ? (
    <div
      className="rounded-[var(--goalops-radius-card)] border border-dashed border-[var(--goalops-border)] bg-slate-50/50 px-5 py-10 text-center text-sm text-[var(--goalops-text-muted)] shadow-[var(--goalops-shadow-card)]"
      role="status"
    >
      正在加载草稿预览所需的字段…
    </div>
  ) : (
    <ObjectiveFormMetricsPreview
      progressFraction={previewProgress}
      ownerDisplayName={ownerResolvedName}
      ownerSub=""
      startIso={form.start_date}
      dueIso={form.due_date}
    />
  )

  const submitDisabled = submitting || membersLoading || !hasMembers || !enumsReady || pageBusy || !!loadError

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
          <span>
            目标记录 ID:{' '}
            <span className="font-medium text-[var(--goalops-text-muted)]">{objectiveId}</span>
          </span>
          {!loadError && !pageBusy ? (
            <span>
              PocketBase objectives ·{' '}
              <span className="font-medium text-[var(--goalops-text-muted)]">就地更新模式</span>
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
          <ObjectiveHeaderOutlineLink to={`/objectives/${objectiveId}`}>返回目标详情</ObjectiveHeaderOutlineLink>
          <ObjectiveHeaderSubmitButton
            formId={FORM_ID}
            label="保存更改"
            busyLabel="保存中…"
            submitting={submitting}
            disabled={submitDisabled}
          />
        </>
      }
      metrics={metrics}
    >
      {!loadError ? (
        <form id={FORM_ID} onSubmit={onSubmit} className="space-y-6">
          <SectionCard title="基本信息">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="edit-obj-name" className={labelCls}>
                  目标名称 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <input
                  id="edit-obj-name"
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
                <label htmlFor="edit-obj-owner" className={labelCls}>
                  负责人 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="edit-obj-owner"
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
                <label htmlFor="edit-obj-status" className={labelCls}>
                  状态 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="edit-obj-status"
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
                <label htmlFor="edit-obj-priority" className={labelCls}>
                  优先级 <span className="text-[var(--goalops-danger)]">*</span>
                </label>
                <select
                  id="edit-obj-priority"
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

          <SectionCard title="时间与进度">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="edit-obj-start" className={labelCls}>
                  开始日期
                </label>
                <input
                  id="edit-obj-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => patch('start_date', e.target.value)}
                  className={`${inputCls} mt-1.5`}
                  disabled={pageBusy}
                />
              </div>
              <div>
                <label htmlFor="edit-obj-due" className={labelCls}>
                  截止日期
                </label>
                <input
                  id="edit-obj-due"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => patch('due_date', e.target.value)}
                  className={`${inputCls} mt-1.5`}
                  disabled={pageBusy}
                />
              </div>
              <div className="sm:col-span-2 sm:max-w-xs">
                <label htmlFor="edit-obj-progress" className={labelCls}>
                  进度（%）
                </label>
                <input
                  id="edit-obj-progress"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={form.progress_percent}
                  onChange={(e) => patch('progress_percent', e.target.value)}
                  className={`${inputCls} mt-1.5 tabular-nums`}
                  disabled={pageBusy}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="定义与背景">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="edit-obj-definition" className={labelCls}>
                  目标摘要
                </label>
                <textarea
                  id="edit-obj-definition"
                  value={form.definition}
                  onChange={(e) => patch('definition', e.target.value)}
                  className={`${inputCls} mt-1.5 min-h-[140px] resize-y`}
                  rows={5}
                  disabled={pageBusy}
                  placeholder={pageBusy ? '加载中…' : undefined}
                />
              </div>
              <div>
                <label htmlFor="edit-obj-background" className={labelCls}>
                  背景叙事
                </label>
                <textarea
                  id="edit-obj-background"
                  value={form.background}
                  onChange={(e) => patch('background', e.target.value)}
                  className={`${inputCls} mt-1.5 min-h-[120px] resize-y lg:min-h-[140px]`}
                  rows={5}
                  disabled={pageBusy}
                  placeholder={pageBusy ? '加载中…' : undefined}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="成功标准与范围">
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <label htmlFor="edit-obj-success-criteria" className={labelCls}>
                  标准条目（每行一条）
                </label>
                <textarea
                  id="edit-obj-success-criteria"
                  value={form.success_criteria}
                  onChange={(e) => patch('success_criteria', e.target.value)}
                  className={`${inputCls} mt-1.5 min-h-[120px] resize-y`}
                  rows={5}
                  disabled={pageBusy}
                  placeholder={pageBusy ? '加载中…' : '每行写入一条标准；请勿粘贴 JSON。'}
                />
                <p className="mt-2 text-xs text-[var(--goalops-text-subtle)]">
                  空行会被忽略；留空则表示清空为无条目。
                </p>
              </div>
              <div>
                <label htmlFor="edit-obj-out-of-scope" className={labelCls}>
                  范围外条目（每行一条）
                </label>
                <textarea
                  id="edit-obj-out-of-scope"
                  value={form.out_of_scope}
                  onChange={(e) => patch('out_of_scope', e.target.value)}
                  className={`${inputCls} mt-1.5 min-h-[120px] resize-y`}
                  rows={4}
                  disabled={pageBusy}
                  placeholder={pageBusy ? '加载中…' : '每行一项「明确不做」；请勿粘贴 JSON。'}
                />
                <p className="mt-2 text-xs text-[var(--goalops-text-subtle)]">
                  空行会被忽略；留空则表示清空为无条目。
                </p>
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
            submitLabel="保存更改"
            busySubmitLabel="保存中…"
            submitting={submitting}
            submitDisabled={submitDisabled}
            cancelHref={`/objectives/${objectiveId}`}
            cancelLabel="取消"
          />
        </form>
      ) : null}
    </ObjectiveFormScaffold>
  )
}
