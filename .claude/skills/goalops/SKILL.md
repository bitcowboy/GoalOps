---
name: goalops
description: GoalOps 目标管理系统及其 MCP 工具的使用指南。当用户在 G:\GitHub\GoalOps 仓库里、谈到 GoalOps / 目标 / 任务 / KR (Key Result) / 卡点 (blocker) / next_actions，或想用 mcp__goalops__* 工具读写数据时调用。包含数据模型、MCP 工具索引、字段限制、典型工作流（建目标 / 拆任务 / 加 KR / 设依赖 / 录卡点）、PocketBase 过滤语法，以及已踩过的坑（MCP 不暴露 phase_timeline/success_criteria、risk_level 落库失败、Windows 上 pb_migrations 中文乱码、React StrictMode + PB autoCancellation 自动取消错误等）。
---

# GoalOps Skill

GoalOps 是这个仓库里的目标 / 任务 / OKR 管理 SPA，前端 React + Vite，后端 PocketBase（SQLite + Go + goja JS 引擎）。配套 MCP 服务器 (`mcp/`) 通过 stdio 把 PocketBase 集合暴露成 LLM 可调用的工具。

## 何时使用本 skill

触发关键词（中英文）：
- 「GoalOps」「目标」「任务 / task」「KR / key result / 关键结果」「卡点 / blocker」「next action / 下一步」
- 任何 `mcp__goalops__*` 工具调用
- 改 `backend/pocketbase/pb_migrations/` 下的迁移文件
- 调试 PocketBase autocancel / SDK 错误

如果用户只是问代码问题（前端 UI、路由、组件），可以不调用本 skill，直接看代码。

---

## 系统总览

| 层 | 路径 | 说明 |
|---|---|---|
| 前端 | `src/` | React 19 + Vite + TS。pb client 单例在 `src/services/pocketbase.ts`，**已全局关闭 `autoCancellation`**。 |
| 后端 | `backend/pocketbase/` | `pocketbase.exe` + `pb_data/data.db`（SQLite）。迁移在 `pb_migrations/`，启动时自动 apply。 |
| MCP | `mcp/` | TS，`npm run build` 产出 `dist/`。注册命令：`claude mcp add goalops -- node "G:/GitHub/GoalOps/mcp/dist/index.js"`。 |
| 文档 | `backend/pocketbase/COLLECTIONS.md`、`mcp/README.md` | schema 参考与 MCP 工具索引。 |

默认 PB 地址 `http://127.0.0.1:8090`，前端 `http://localhost:5173`。

---

## 数据模型（PocketBase 集合）

```
objectives ──┬── key_results       (1-N, cascade)
             ├── tasks             (1-N, cascade) ──── key_result (optional N-1)
             ├── blockers          (1-N, cascade)
             ├── deliverables      (1-N)
             └── core_documents    (1-N)
members ────── owner / assignee / participant_ids  (relation)
```

### `objectives` — 关键字段

| 字段 | 类型 | 备注 |
|---|---|---|
| `name` | text | |
| `definition` | editor (HTML) | 合并了旧 `one_sentence_definition` + `background` |
| `priority` | select | `P0`–`P3` |
| `status` | select | `not_started` / `explore_plan` / `in_progress` / `paused` / `in_review` / `done` / `cancelled`（含 `draft` 历史值） |
| `risk_level` | select | `low` / `medium` / `high`（⚠️ 通过 MCP 写入可能失败，见下方 gotcha） |
| `start_date` / `due_date` | date | YYYY-MM-DD 输入 |
| `progress_percent` | number | 0–100 |
| `owner` | relation → members | 单选 |
| `participant_ids` | json | 成员 id 数组 |
| `out_of_scope` | json | 字符串数组 |
| `current_blockers_summary` | text(20000) | 卡点摘要（与 blockers 表互补） |
| `phase_timeline` | json | 阶段时间线对象数组，**MCP update 不暴露** |
| `success_criteria` | json | 验收标准字符串数组，**MCP update 不暴露** |
| `next_actions` | json | 行动建议对象数组，**用专门的 next_actions 工具读写** |
| `display_code` | text | 展示编码如 `OBJ-2025-022` |

### `tasks` — 关键字段

| 字段 | 类型 | 备注 |
|---|---|---|
| `title` | text | required |
| `objective` | relation | **required** |
| `key_result` | relation | 可选，关联到 KR |
| `assignee` | relation → members | 可选 |
| `status` | select | `pending` / `in_progress` / `deliver` / `review` / `done` |
| `priority` | select | `P0`–`P3` |
| `predecessor_ids` | json | 前置 task id 数组 |
| `estimate_hours` | number | |
| `due_date` | date | |

### `key_results` — 关键字段

| 字段 | 类型 | 备注 |
|---|---|---|
| `objective` | relation | required，级联删除 |
| `name` | text | KR 描述 |
| `is_completed` | bool | Checkbox 型 KR |
| `owner` | relation → members | 可选 |
| `note` | text | |
| `sort_order` | int | 展示顺序 |

### `blockers` — 关键字段

| 字段 | 类型 | 备注 |
|---|---|---|
| `description` | text | required ⚠️ 旧库可能缺失此字段，见下方 gotcha |
| `severity` | select | `low` / `medium` / `high` ⚠️ 同上 |
| `objective` | relation | |
| `owner` | relation → members | |
| `target_resolution_date` | date | |

### `next_actions` JSON 数组（在 `objectives` 上）

每条元素：
```json
{
  "suggestion": "...",
  "suggestion_date": "YYYY-MM-DD",
  "priority": "P0|P1|P2|P3",
  "type": "plan|decision|milestone|followup|...",
  "suggester_name": "",
  "suggester_initials": ""
}
```

---

## MCP 工具索引

所有工具前缀 `mcp__goalops__`。完整能力按集合分组：

### Objectives
- `goalops_objectives_list` — `filter` / `sort` / `limit` / `expandOwner`
- `goalops_objectives_get` — `id`、可选 `expandOwner`
- `goalops_objectives_create` — `name`+`owner` 必填，含 `definition / start_date / due_date / progress_percent / out_of_scope / participant_ids / risk_level / current_blockers_summary / display_code`
- `goalops_objectives_update` — **仅暴露以下字段**：`name / definition / display_code / due_date / start_date / progress_percent / status / priority / risk_level / owner / participant_ids / out_of_scope / current_blockers_summary`
- `goalops_objectives_delete` — 级联

> ⚠️ **`phase_timeline` / `success_criteria` / `next_actions` 不在 update 里**。前两者必须通过 PB Admin UI 手改；`next_actions` 用下面的专用工具。

### Tasks
- `goalops_tasks_list / get / create / update / delete`
- `update` 支持 `key_result: null` / `assignee: null` 显式清空
- `predecessor_ids` 是 string 数组

### Key Results
- `goalops_key_results_list / create / update / delete`
- `update` 翻 `is_completed` 即可标记完成

### Blockers
- `goalops_blockers_list / create / update / delete`
- `severity` 枚举 `low / medium / high`

### Next Actions（objectives 上的 JSON 数组）
- `goalops_next_actions_list` — 读
- `goalops_next_actions_set` — 整体替换数组
- `goalops_next_actions_append` — 追加一条
- 每条元素：`suggestion`（必填）、`suggestion_date`（必填）、可选 `priority / type / suggester_name / suggester_initials / suggester_color`

---

## 工作流配方

### 配方 1 · 全新建目标（含 KR + tasks）

```text
1. goalops_objectives_create     → 拿 objective id
2. goalops_key_results_create    → 一次建 3-6 条 KR（并发）
3. goalops_tasks_create          → 建 task；要关联 KR 就传 key_result
4. goalops_tasks_update          → 加 predecessor_ids 形成依赖链
5. goalops_next_actions_set      → 写本周关键动作
6. goalops_blockers_create       → 把外部依赖登记成正式卡点
7. （UI 手改）phase_timeline + success_criteria + risk_level
```

并发原则：每步内的多条独立写入要放进**同一个 message 的 multi-tool-use** 里并发执行，能省非常多时间。

### 配方 2 · 改造已有目标（重新基线 + 拆 task）

```text
1. goalops_objectives_get               → 读现状
2. goalops_objectives_update            → 改 start_date / due_date / progress_percent / definition / out_of_scope / current_blockers_summary
3. goalops_next_actions_set             → 替换 next_actions
4. goalops_blockers_list                → 看现有卡点
5. goalops_blockers_create              → 补登记新卡点
6. goalops_tasks_list filter=objective="..."  → 看现有任务
7. goalops_tasks_create + tasks_update  → 补 task、加 KR/predecessor 链
```

### 配方 3 · KR 跑完打勾 + 自动算 objective 进度

前端 `recomputeObjectiveProgressFromKeyResults` 已经做了。代码路径走 UI；MCP 这边没有"自动重算进度"接口，需要：
```text
goalops_key_results_update  → is_completed: true
goalops_objectives_update   → progress_percent: <自己算>
```

### 配方 4 · 阻塞排查

```text
goalops_blockers_list filter=severity="high"
goalops_tasks_list filter='status="pending" && objective.priority="P0"'  # 注意 PB 不支持跨表过滤，要拆两步
```

---

## PocketBase 过滤语法速查

```text
status="in_progress" && priority="P0"
objective="obj100000000001"
assignee="mbr100000000001" && status!="done"
due_date>="2026-05-01" && due_date<"2026-06-01"
predecessor_ids ~ "tsk100000000001"       # JSON 列模糊匹配（"包含此 id"的实用 hack）
```

- 字符串必须双引号
- 关系字段用 id 比较
- `~` 是 LIKE
- 不支持跨表 join 过滤（如 `objective.priority="P0"` 无效）

---

## ⚠️ 已知坑 / 调试要点

### 1. MCP `objectives_update` 不暴露 phase_timeline / success_criteria
- 现象：调用成功但字段没动
- 影响：`phase_timeline`（阶段时间线）、`success_criteria`（验收标准）
- 解决：让用户在 PB Admin UI（或前端编辑页）手改；给出 JSON 文案即可

### 2. `risk_level` 通过 MCP 写入可能失败
- 现象：`goalops_objectives_update` 传 `risk_level: "medium"` 返回 "Failed to update record"
- 原因：服务端 select 字段元数据格式与 SDK 期望不一致（`{value, text}` vs 纯字符串数组），新旧 PB 版本兼容问题
- 解决：用 UI 选择；或参考 `pb_migrations/1778100200` 写一个修复迁移把 values 改成纯字符串数组

### 3. blockers 集合缺 description / severity 字段
- 现象：`blockers_create` 返回成功，但 `description` 和 `severity` 没落库；前端"问题描述"列空白
- 根因：本地 DB 的 schema 实际不包含这两个字段（迁移漂移）
- 修复：`pb_migrations/1778100400_goalops_fix_blockers_fields.js` 已经补回。新库可直接用 initial migration。
- 验证：`curl -s "http://127.0.0.1:8090/api/collections/blockers/records?perPage=50"` 直查

### 4. Windows 上 pb_migrations 里的中文 → 乱码
- 现象：迁移源里 `r.set('description', '原型关卡...')` 写进 DB 后是 `鍘熷瀷...` 这种 GB18030 乱码
- 根因：PocketBase 的 goja JS 引擎在 Windows 上读 .js 源文件时按系统代码页（GBK / GB18030）解析，而文件本身是 UTF-8
- **铁律：迁移文件只做 schema 变更，不要在迁移体里写中文业务文本**
- 数据回填走 MCP / HTTP（JSON over HTTP 是标准 UTF-8）
- 如必须在迁移里写中文：用 `原型` Unicode 转义

### 5. React StrictMode + PB SDK autoCancellation
- 现象：详情页一进就显示红条 "The request was aborted (most likely autocancelled)"
- 根因：StrictMode 双 mount + 同一个 URL 的 pb 调用 → SDK 自动取消前一次 → 第一次的 catch 抛错盖掉第二次的成功
- 已修复：`src/services/pocketbase.ts:17` 加了 `pb.autoCancellation(false)`
- 个别需要保留取消语义的请求：显式传 `requestKey: '<unique>'`

### 6. MCP tasks_update 清空字段
- 显式传 `key_result: null` 或 `assignee: null` 才能清空（compactRecord 保留 null，丢 undefined）

---

## 文件指路

| 想干什么 | 看哪里 |
|---|---|
| Schema 总览 | `backend/pocketbase/COLLECTIONS.md` |
| MCP 工具实现 | `mcp/src/tools/{objectives,tasks,keyResults,blockers,nextActions}.ts` |
| MCP 入口 | `mcp/src/index.ts` |
| PB client（前端） | `src/services/pocketbase.ts` |
| PB client（MCP） | `mcp/src/pbClient.ts` |
| 目标列表加载 | `src/features/objectives/loadObjectivesList.ts` |
| 目标详情页 | `src/pages/ObjectiveDetailPage.tsx` + `src/features/objectives/ObjectiveDetailView.tsx` |
| 任务详情页 | `src/pages/TaskDetailPage.tsx` |
| 任务看板 | `src/features/tasks/loadTasksBoard.ts` + `src/pages/TasksPage.tsx` |
| 进度自动计算 | `src/features/objectives/createObjective.ts::recomputeObjectiveProgressFromKeyResults` |
| 迁移目录 | `backend/pocketbase/pb_migrations/` |

---

## 调试命令

```powershell
# 直查某 collection 的原始数据（绕开前端 / MCP）
curl -s "http://127.0.0.1:8090/api/collections/blockers/records?perPage=50" | python -m json.tool

# 按 objective 过滤
curl -s 'http://127.0.0.1:8090/api/collections/tasks/records?filter=objective%3D%22obj200000000002%22' | python -m json.tool

# MCP 重新构建
cd G:/GitHub/GoalOps/mcp; npm run build

# 重启 PocketBase 让新迁移生效
Stop-Process -Name pocketbase -Force
& "G:\GitHub\GoalOps\backend\pocketbase\pocketbase.exe" serve

# typecheck / lint（写代码后）
npx tsc --noEmit
npx eslint src/**/*.{ts,tsx}
```

---

## 约定与建议

- **大批量写入**用 multi-tool-use 并发，能省 5-10 倍时间
- **每次只 update 一类字段** 当某个字段失败时（如 risk_level），便于二分定位
- **写中文** 不要写在 pb_migrations 的字符串字面量里；要么转义要么用 MCP/HTTP 回填
- **任务 / KR / blocker 三件套** 一起建：单独建 task 会失去与 KR 的连接，单独建 blocker 会失去和任务的关联
- **预设依赖链** 建 task 时如果能想清楚顺序，直接在 `predecessor_ids` 里写好，省一轮 update
