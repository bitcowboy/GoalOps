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

## `key_results`（关键结果） **v0.3.3 / v1.0 metric**

| 字段 | 类型 | 说明 |
|------|------|------|
| `objective` | relation | → `objectives`，必填，随目标级联删除 |
| `name` | text | KR 描述 |
| `kr_type` | select | **v1.0** `metric` / `checkbox` / `milestone`（迁移后存量统一回填 `checkbox`） |
| `is_completed` | bool | 仅 checkbox 类用；metric / milestone 不再参与进度统计 |
| `start_value` | number | 仅 metric：KR 设立时起点 |
| `target_value` | number | 仅 metric：期末目标 |
| `unit` | text | 仅 metric：单位（如 `%`、`ms`） |
| `direction` | select | 仅 metric：`increase` / `decrease`（打分方向） |
| `contributors` | relation (multi) | → `members`，KR 贡献者；前端本迭代只读展示 |
| `owner` | relation | → `members`，可选 |
| `note` | text | 备注 |
| `sort_order` | number | 展示顺序（整数，可选） |

约束（PB hook `pb_hooks/kr_type_validation.pb.js`）：
- `kr_type` 必填且属于三类之一
- `kr_type=metric` 时 `start_value / target_value / unit / direction` 必填

派生字段（不存表，由 endpoint `/api/goalops/key_results/{id}/derived` 返回）：
`latest_value / latest_confidence / latest_checkin_date / score`。

---

## `kr_checkins`（KR 周期快照） **v1.0**

| 字段 | 类型 | 说明 |
|------|------|------|
| `key_result` | relation | → `key_results`，必填，级联删除 |
| `checkin_date` | date | 业务日期（YYYY-MM-DD），不能晚于今天 |
| `checkin_type` | select | `weekly` / `milestone` / `adhoc` |
| `current_value` | number | 仅 metric KR：当前值 |
| `progress_percent` | number | 仅 milestone KR：0–100 |
| `is_completed` | bool | 仅 checkbox KR：终态 |
| `confidence` | number | 1–10 整数，对期末达成的主观信心 |
| `status_signal` | select | `on_track` / `at_risk` / `off_track`，默认按 confidence 派生 |
| `progress_note` | text | 必填：做了什么 / 数据是什么 |
| `blockers_note` | text | 可选：本周阻塞（不升级为正式 blocker） |
| `next_focus` | text | 可选：下周聚焦 |
| `author` | relation | → `members`，提交人 |
| `created` / `updated` | autodate | 自动填充 |

索引：`(key_result, checkin_date DESC)`、`(key_result)`。

类型一致性校验（`pb_hooks/kr_checkin_validation.pb.js`）：基于关联 KR 的 `kr_type` 强制度量字段三选一；检测「显式传值」通过 `e.requestInfo().body`，绕开 PB 数字字段服务端默认 0 的歧义。

---

## `objectives`（目标）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | text | 名称 |
| `definition` | editor | 目标描述（合并了原 `one_sentence_definition` 与 `background`；存储为带 `<p><br/>` 的 editor 文本，前端按纯文本读写） |
| `progress_percent` | number | 进度 0–100 |
| `status` | select | 含 `draft`（草稿）、`not_started` / `in_progress` / … |
| `priority` | select | 如：`P0`–`P3` |
| `owner` | relation | → `members`（单选） |
| `risk_level` | select | 风险：`low` / `medium` / `high` |
| `current_blockers_summary` | text | 卡点摘要（创建表单） |
| `draft_deliverables` | json | 历史字段，当前最小化 OKR 表单不展示 |
| `draft_core_documents` | json | 历史字段，当前最小化 OKR 表单不展示 |
| `start_date` | date | 开始 |
| `due_date` | date | 截止 |
| `display_code` | text | 展示用编码（如 `OBJ-2025-024`） |
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
