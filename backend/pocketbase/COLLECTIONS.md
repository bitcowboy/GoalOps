# PocketBase Collections（MVP 草案）

> **实现状态**：本项目已通过 `pb_migrations/` 中的 JS 迁移自动创建下列集合并写入 PRD §14 示例数据；下表供对照与微调字段时参考。若你改为在 Admin 手工建表，请保持字段名一致以便前端少改映射。

## 通用约定

- 主键：`id` 为 **15 个字符**，仅含 `[a-z0-9]`（PocketBase 对自定义 `id` 的格式要求；种子数据使用形如 `mbr100000000001`、`obj100000000001` 的占位 id）。
- 日期：优先用 `date` 或 `text`（ISO 8601）
- 关联：`relation` 指向对应集合（可多选处用 `json` 存 id 数组亦可）

---

## `members`（人员）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | text | 姓名 |
| `role` | text | 角色 |
| `team` | text | 小组 |
| `weekly_available_hours` | number | 每周可用工时 |
| `status` | select | **v0.3.3** `active`（在岗） / `inactive`（停用）；历史数据空值前端视为 `active` |

---

## `key_results`（关键结果，Checkbox）**v0.3.3**

| 字段 | 类型 | 说明 |
|------|------|------|
| `objective` | relation | → `objectives`，必填，随目标级联删除 |
| `name` | text | KR 描述 |
| `is_completed` | bool | 是否完成 |
| `owner` | relation | → `members`，可选 |
| `note` | text | 备注 |
| `sort_order` | number | 展示顺序（整数，可选） |

---

## `objectives`（目标）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | text | 名称 |
| `definition` | editor | 定义（富文本） |
| `one_sentence_definition` | text | 一句话概括（创建表单） |
| `progress_percent` | number | 进度 0–100 |
| `status` | select | 含 `draft`（草稿）、`not_started` / `in_progress` / … |
| `priority` | select | 如：`P0`–`P3` |
| `owner` | relation | → `members`（单选） |
| `participant_ids` | json | 参与成员 id 数组（可选） |
| `risk_level` | select | 风险：`low` / `medium` / `high` |
| `current_blockers_summary` | text | 卡点摘要（创建表单） |
| `draft_deliverables` | json | 历史字段，当前最小化 OKR 表单不展示 |
| `draft_core_documents` | json | 历史字段，当前最小化 OKR 表单不展示 |
| `start_date` | date | 开始 |
| `due_date` | date | 截止 |
| `display_code` | text | 展示用编码（如 `OBJ-2025-024`） |
| `background` | text | 目标描述 |
| `success_criteria` | json | 历史字段，当前最小化 OKR 不展示且保存时写空数组 |
| `out_of_scope` | json | 不属于本目标范围（字符串数组） |
| `phase_timeline` | json | 历史字段，当前最小化 OKR 详情页不展示 |
| `next_actions` | json | 行动建议（对象数组） |
| `progress_delta_percent` | number | 可选，相对上周进度变化（百分点） |

---

## `tasks`（任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | text | 标题 |
| `objective` | relation | → `objectives`，**必填** |
| `key_result` | relation | → `key_results`，**可选** |
| `assignee` | relation | → `members` |
| `status` | select | 对应 PRD 流转：`pending`→…→`done` |
| `priority` | select | `P0`–`P3` |
| `predecessor_ids` | json | 前置任务 id 数组（若不用多对多关系） |
| `estimate_hours` | number | 预估工时（可选） |
| `due_date` | date | 截止日期（可选） |

---

## `deliverables`（交付件）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | text | 名称 |
| `objective` | relation | → `objectives` |
| `status` | text | 交付状态描述 |
| `version` | text | 版本号 |
| `planned_completion_date` | date | 计划完成日 |

---

## `core_documents`（核心文档）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | text | 标题 |
| `url` | url | 链接 |
| `objective` | relation | → `objectives` |
| `version` | text | 文档版本 |
| `doc_status` | text | 文档状态（如草稿 / 评审中 / 已确认） |
| `owner` | relation | → `members`（可选） |

---

## `blockers`（卡点）

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | text | 描述 |
| `severity` | select | 严重程度 |
| `objective` | relation | → `objectives` |
| `owner` | relation | → `members`（可选，责任人） |
| `target_resolution_date` | date | 目标解决日 |

---

## 索引与查询

后续实现页面时，可针对 `objectives.status`、`tasks.objective`、`tasks.assignee` 等常用过滤字段在 Admin 中开启索引以优化列表性能。
