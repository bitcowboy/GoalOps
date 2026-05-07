import type { RecordModel } from 'pocketbase'
import {
  clampPercent,
  coerceObjectiveStatusForWrite,
  editorToPlainText,
  objectiveStatusLabel,
  parseStringArray,
} from '@/features/objectives/objectiveDetailUtils'
import { pb } from '@/services/pocketbase'

export type ObjectiveOwnerOption = {
  id: string
  name: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 将表单纯文本转换为 PocketBase editor 字段可读的简单 HTML */
export function plainTextToEditorHtml(text: string): string {
  const lines = text.split('\n')
  const inner = lines.map((line) => escapeHtml(line)).join('<br/>')
  return `<p>${inner}</p>`
}

export async function fetchObjectiveOwnerOptions(): Promise<ObjectiveOwnerOption[]> {
  const records = await pb.collection('members').getFullList({
    sort: 'name',
    batch: 500,
    requestKey: `members_for_objective_create_${Date.now()}`,
  })
  return records.map((r) => ({
    id: r.id,
    name: String(r.name ?? r.id),
  }))
}

/** 与迁移中 objectives.status 一致：仅 7 档（英文 code） */
export const OBJECTIVE_STATUS_VALUES = [
  'not_started',
  'explore_plan',
  'in_progress',
  'paused',
  'in_review',
  'done',
  'cancelled',
] as const

const CANONICAL_STATUS_VALUE_SET = new Set<string>(OBJECTIVE_STATUS_VALUES)

/**
 * 去掉与规范 status 同义、展示标签也相同的库内取值（如「进行中」与 in_progress），避免下拉里出现两个「进行中」。
 */
function filterSeenStatusValuesForOptions(seen: Set<string>): Set<string> {
  const out = new Set<string>()
  for (const v of seen) {
    const t = v.trim()
    if (!t) continue
    const coerced = coerceObjectiveStatusForWrite(t)
    if (
      t !== coerced &&
      CANONICAL_STATUS_VALUE_SET.has(coerced) &&
      objectiveStatusLabel(t) === objectiveStatusLabel(coerced)
    ) {
      continue
    }
    out.add(t)
  }
  return out
}

/** 与迁移中 objectives.priority 取值一致 */
export const OBJECTIVE_PRIORITY_VALUES = ['P0', 'P1', 'P2', 'P3'] as const

export type ObjectiveSelectOption = { value: string; label: string }

function mergeObjectiveSelectOptions(
  canonical: ObjectiveSelectOption[],
  seenInDb: Set<string>,
  labelOf: (raw: string) => string,
): ObjectiveSelectOption[] {
  const map = new Map<string, string>()
  for (const c of canonical) map.set(c.value, c.label)
  for (const v of seenInDb) {
    if (!map.has(v)) map.set(v, labelOf(v))
  }
  const canonOrder = canonical.map((c) => c.value)
  const canonSet = new Set(canonOrder)
  const ordered: ObjectiveSelectOption[] = []
  for (const value of canonOrder) {
    if (!map.has(value)) continue
    ordered.push({ value, label: map.get(value)! })
  }
  const rest = [...map.keys()].filter((k) => !canonSet.has(k)).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  for (const value of rest) {
    ordered.push({ value, label: map.get(value)! })
  }
  return ordered
}

/**
 * 合并 COLLECTIONS.md 约定取值与库内已出现取值，避免因 Admin 里仅配置中文 value 时下拉缺少可选项；
 * 实际合法值仍以 PocketBase 集合配置为准（可运行迁移 `1778095000_goalops_objectives_align_select_values` 对齐）。
 */
export async function fetchObjectiveStatusPriorityOptions(): Promise<{
  statuses: ObjectiveSelectOption[]
  priorities: ObjectiveSelectOption[]
}> {
  const rows = await pb.collection('objectives').getFullList({
    fields: 'status,priority',
    batch: 500,
    requestKey: `objective_select_opts_${Date.now()}`,
  })
  const seenS = new Set<string>()
  const seenP = new Set<string>()
  for (const r of rows) {
    const s = String(r.status ?? '').trim()
    const p = String(r.priority ?? '').trim()
    if (s) seenS.add(s)
    if (p) seenP.add(p)
  }

  const canonicalStatuses = OBJECTIVE_STATUS_VALUES.map((value) => ({
    value,
    label: objectiveStatusLabel(value),
  }))
  const canonicalPriorities = OBJECTIVE_PRIORITY_VALUES.map((value) => ({
    value,
    label: value,
  }))

  const statuses = mergeObjectiveSelectOptions(
    canonicalStatuses,
    filterSeenStatusValuesForOptions(seenS),
    (raw) => objectiveStatusLabel(raw),
  )
  const priorities = mergeObjectiveSelectOptions(
    canonicalPriorities,
    seenP,
    (raw) => raw,
  )

  return { statuses, priorities }
}

export type ObjectiveDraftDeliverableRow = {
  title: string
  planned_completion_date: string
}

export type ObjectiveDraftCoreDocumentRow = {
  title: string
  /** 文档外链（飞书 / Notion / Wiki 等），非上传文件 */
  url: string
}

export type CreateObjectiveInput = {
  name: string
  owner: string
  /** 必须是当前 PocketBase `objectives` 集合里允许的 value（常为英文 code，也可能是中文配置） */
  status: string
  priority: string
  definition: string
  /** Stored in objectives.one_sentence_definition */
  one_sentence_definition: string
  /** Plain text stored in `background` */
  background: string
  /** One non-empty trimmed line → one array entry in PocketBase JSON field `success_criteria` */
  success_criteria: string
  /** One non-empty trimmed line → one array entry in JSON field `out_of_scope` */
  out_of_scope: string
  start_date: string
  due_date: string
  progress_percent: number | null
  /** Member record ids */
  participant_ids: string[]
  /** objectives.risk_level: low | medium | high */
  risk_level: string
  /** objectives.current_blockers_summary */
  current_blockers_summary: string
  /** Each non-empty line → one next_actions entry */
  action_suggestions_text: string
  draft_deliverables: ObjectiveDraftDeliverableRow[]
  draft_core_documents: ObjectiveDraftCoreDocumentRow[]
}

export type CreatedObjectiveMeta = {
  id: string
  name: string
}

/** 供 `<input type="date">` 绑定：兼容 PB 日期字符串（含空格 / Z）。 */
export function pbValueToDateInput(raw: unknown): string {
  if (raw == null || raw === '') return ''
  const s = String(raw).trim()
  const m = /^\d{4}-\d{2}-\d{2}/.exec(s)
  if (m) return m[0]!
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const mo = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${mo}-${day}`
}

export type ObjectiveFormDraftFields = Omit<CreateObjectiveInput, 'progress_percent'> & {
  progress_percent: string
}

/** 将编辑/创建表单草稿转为 API 写入结构（progress_percent 由字符串解析）。 */
export function objectiveDraftToCreateInput(draft: ObjectiveFormDraftFields): CreateObjectiveInput {
  const p = draft.progress_percent.trim()
  const progress_percent = p === '' ? null : Number(p)
  if (progress_percent !== null && (Number.isNaN(progress_percent) || progress_percent < 0 || progress_percent > 100)) {
    throw new Error('进度需在 0–100 之间')
  }
  return {
    name: draft.name,
    owner: draft.owner,
    status: coerceObjectiveStatusForWrite(draft.status),
    priority: draft.priority,
    definition: draft.definition,
    one_sentence_definition: draft.one_sentence_definition,
    background: draft.background,
    success_criteria: draft.success_criteria,
    out_of_scope: draft.out_of_scope,
    start_date: draft.start_date,
    due_date: draft.due_date,
    progress_percent,
    participant_ids: [...draft.participant_ids],
    risk_level: draft.risk_level,
    current_blockers_summary: draft.current_blockers_summary,
    action_suggestions_text: draft.action_suggestions_text,
    draft_deliverables: draft.draft_deliverables.map((r) => ({
      title: r.title,
      planned_completion_date: r.planned_completion_date,
    })),
    draft_core_documents: draft.draft_core_documents.map((r) => ({
      title: r.title,
      url: r.url ?? '',
    })),
  }
}

/** Multiline textarea: each line becomes one JSON string entry; empty lines dropped. */
export function normalizeObjectiveLinesField(raw: string): string[] {
  return raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
}

function linesFieldFromRecord(record: RecordModel, key: 'success_criteria' | 'out_of_scope'): string {
  return parseStringArray(record[key]).join('\n')
}

function parseParticipantIds(record: RecordModel): string[] {
  const raw = record.participant_ids
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && !!x.trim())
}

function isDraftDeliverable(x: unknown): x is ObjectiveDraftDeliverableRow {
  if (!x || typeof x !== 'object') return false
  const o = x as ObjectiveDraftDeliverableRow
  return typeof o.title === 'string'
}

function isDraftDoc(x: unknown): x is Record<string, unknown> & { title: string } {
  if (!x || typeof x !== 'object') return false
  return typeof (x as { title?: unknown }).title === 'string'
}

function parseDraftDeliverables(record: RecordModel): ObjectiveDraftDeliverableRow[] {
  const raw = record.draft_deliverables
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isDraftDeliverable)
    .map((r) => ({
      title: r.title.trim(),
      planned_completion_date: pbValueToDateInput(r.planned_completion_date ?? ''),
    }))
    .filter((r) => r.title.length > 0)
}

function parseDraftCoreDocs(record: RecordModel): ObjectiveDraftCoreDocumentRow[] {
  const raw = record.draft_core_documents
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isDraftDoc)
    .map((r) => {
      const title = String(r.title ?? '').trim()
      let url = typeof r.url === 'string' ? r.url.trim() : ''
      if (!url) {
        const ver = String(r.version ?? '').trim()
        if (ver.startsWith('http://') || ver.startsWith('https://')) url = ver
      }
      return { title, url }
    })
    .filter((r) => r.title.length > 0)
}

function parseNextActionsToLines(record: RecordModel): string {
  const raw = record.next_actions
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
  const lines = arr
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      const s = (item as { suggestion?: unknown }).suggestion
      return typeof s === 'string' ? s.trim() : ''
    })
    .filter(Boolean)
  return lines.join('\n')
}

export function objectiveRecordToFormDraft(record: RecordModel): ObjectiveFormDraftFields {
  const ownerId = typeof record.owner === 'string' ? record.owner : ''
  return {
    name: String(record.name ?? ''),
    owner: ownerId,
    status: coerceObjectiveStatusForWrite(String(record.status ?? '')),
    priority: String(record.priority ?? '').trim(),
    definition: editorToPlainText(String(record.definition ?? '')),
    one_sentence_definition: String(record.one_sentence_definition ?? '').trim(),
    background: String(record.background ?? ''),
    success_criteria: linesFieldFromRecord(record, 'success_criteria'),
    out_of_scope: linesFieldFromRecord(record, 'out_of_scope'),
    start_date: pbValueToDateInput(record.start_date),
    due_date: pbValueToDateInput(record.due_date),
    progress_percent: String(clampPercent(record.progress_percent ?? 0)),
    participant_ids: parseParticipantIds(record),
    risk_level: String(record.risk_level ?? '').trim(),
    current_blockers_summary: String(record.current_blockers_summary ?? ''),
    action_suggestions_text: parseNextActionsToLines(record),
    draft_deliverables: parseDraftDeliverables(record),
    draft_core_documents: parseDraftCoreDocs(record),
  }
}

function validateObjectiveInput(input: CreateObjectiveInput): void {
  if (!input.name.trim()) throw new Error('请填写目标名称')
  if (!input.owner.trim()) throw new Error('请选择负责人')
  if (!input.status.trim()) throw new Error('请选择状态')
  if (!input.priority.trim()) throw new Error('请选择优先级')
}

function buildObjectiveWritePayload(input: CreateObjectiveInput): Record<string, unknown> {
  const name = input.name.trim()
  const owner = input.owner.trim()
  const body: Record<string, unknown> = {
    name,
    owner,
    status: input.status,
    priority: input.priority,
  }

  const oneLine = input.one_sentence_definition.trim()
  const defLegacy = input.definition.trim()
  const definitionSource = oneLine || defLegacy
  body.definition = definitionSource ? plainTextToEditorHtml(definitionSource) : ''
  body.one_sentence_definition = oneLine

  const start = input.start_date.trim()
  const due = input.due_date.trim()
  if (start) body.start_date = start
  if (due) body.due_date = due

  if (input.progress_percent !== null && input.progress_percent !== undefined) {
    body.progress_percent = clampPercent(input.progress_percent)
  }

  body.background = input.background.trim()

  const successLines = normalizeObjectiveLinesField(input.success_criteria)
  const outLines = normalizeObjectiveLinesField(input.out_of_scope)
  body.success_criteria = successLines.length > 0 ? successLines : []
  body.out_of_scope = outLines.length > 0 ? outLines : []

  const participantIds = input.participant_ids.map((id) => id.trim()).filter(Boolean)
  body.participant_ids = participantIds.length > 0 ? participantIds : []

  const rk = input.risk_level.trim()
  if (rk) body.risk_level = rk

  body.current_blockers_summary = input.current_blockers_summary.trim()

  const suggestionLines = normalizeObjectiveLinesField(input.action_suggestions_text)
  const today = new Date().toISOString().slice(0, 10)
  body.next_actions =
    suggestionLines.length > 0
      ? suggestionLines.map((suggestion) => ({
          suggestion,
          type: 'plan',
          priority: 'P2',
          suggester_name: '',
          suggester_initials: '',
          suggestion_date: today,
        }))
      : []

  const delRows = input.draft_deliverables
    .map((row) => ({
      title: row.title.trim(),
      planned_completion_date: row.planned_completion_date.trim(),
    }))
    .filter((row) => row.title.length > 0)

  body.draft_deliverables = delRows

  const docRows = input.draft_core_documents
    .map((row) => ({
      title: row.title.trim(),
      url: row.url.trim(),
    }))
    .filter((row) => row.title.length > 0)

  body.draft_core_documents = docRows

  return body
}

export async function createObjective(input: CreateObjectiveInput): Promise<CreatedObjectiveMeta> {
  validateObjectiveInput(input)
  const body = buildObjectiveWritePayload(input)
  const rec = await pb.collection('objectives').create(body)
  const name = input.name.trim()
  return {
    id: rec.id,
    name: String(rec.name ?? name),
  }
}

export async function updateObjective(
  objectiveId: string,
  input: CreateObjectiveInput,
): Promise<CreatedObjectiveMeta> {
  validateObjectiveInput(input)
  const body = buildObjectiveWritePayload(input)
  const rec = await pb.collection('objectives').update(objectiveId, body)
  const name = input.name.trim()
  return {
    id: rec.id,
    name: String(rec.name ?? name),
  }
}
