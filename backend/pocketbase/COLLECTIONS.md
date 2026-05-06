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

---

## `objectives`（目标）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | text | 名称 |
| `definition` | text | 定义 |
| `progress_percent` | number | 进度 0–100 |
| `status` | select | 如：`not_started` / `in_progress` / `at_risk` / `done` |
| `priority` | select | 如：`P0`–`P3` |
| `owner` | relation | → `members`（单选） |
| `start_date` | date | 开始 |
| `due_date` | date | 截止 |

---

## `tasks`（任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | text | 标题 |
| `objective` | relation | → `objectives`，**必填** |
| `assignee` | relation | → `members` |
| `status` | select | 对应 PRD 流转：`pending`→…→`done` |
| `priority` | select | `P0`–`P3` |
| `predecessor_ids` | json | 前置任务 id 数组（若不用多对多关系） |
| `estimate_hours` | number | 预估工时（可选） |

---

## `deliverables`（交付件）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | text | 名称 |
| `objective` | relation | → `objectives` |
| `status` | text | 交付状态描述 |

---

## `core_documents`（核心文档）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | text | 标题 |
| `url` | url | 链接 |
| `objective` | relation | → `objectives` |

---

## `blockers`（卡点）

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | text | 描述 |
| `severity` | select | 严重程度 |
| `objective` | relation | → `objectives` |

---

## `misc_work`（会议 / 杂事）

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | text | 标题 |
| `member` | relation | → `members` |
| `kind` | select | 如：`meeting` / `ad_hoc` |
| `hours` | number | 占用工时 |

---

## 索引与查询

后续实现页面时，可针对 `objectives.status`、`tasks.objective`、`tasks.assignee` 等常用过滤字段在 Admin 中开启索引以优化列表性能。
