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
objectives ──┬── key_results       (1-N, cascade) ── kr_checkins (1-N, cascade)
             ├── tasks             (1-N, cascade) ──── key_result (optional N-1)
             ├── blockers          (1-N, cascade)
             ├── deliverables      (1-N)
             └── core_documents    (1-N)
members ────── owner / assignee / contributors / author (relation)
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

### `key_results` — 关键字段 **v1.0 加 metric/milestone**

| 字段 | 类型 | 备注 |
|---|---|---|
| `objective` | relation | required，级联删除 |
| `name` | text | KR 描述 |
| `kr_type` | select | `metric` / `checkbox` / `milestone`，迁移后存量统一为 `checkbox` |
| `is_completed` | bool | 仅 checkbox 类；metric / milestone 不再参与 objective 进度统计 |
| `start_value` / `target_value` / `unit` / `direction` | metric only | hook 在 metric 类下强校验四个一起填 |
| `contributors` | relation (multi) → members | KR 贡献者，前端 v1.0 只读展示 |
| `owner` | relation → members | 可选 |
| `note` | text | |
| `sort_order` | int | 展示顺序 |

派生字段（非存表）：`/api/goalops/key_results/{id}/derived` 返回 `latest_value / latest_confidence / latest_checkin_date / score`。MCP `key_results_get|list` 支持 `expand=derived` 透传该 endpoint。

### `kr_checkins` — 关键字段 **v1.0 新增**

KR 的时间点快照（现状/信心/聚焦）。

| 字段 | 类型 | 备注 |
|---|---|---|
| `key_result` | relation → key_results | required，级联删除 |
| `checkin_date` | date | YYYY-MM-DD，**不能晚于今天**（hook 校验） |
| `checkin_type` | select | `weekly` / `milestone` / `adhoc` |
| `current_value` | number | 仅 metric KR 写入 |
| `progress_percent` | number | 仅 milestone KR 写入，0–100 |
| `is_completed` | bool | 仅 checkbox KR 写入 |
| `confidence` | int | 1–10 |
| `status_signal` | select | `on_track` / `at_risk` / `off_track`，未传时按 confidence 自动派生（≥7 / 4–6 / ≤3） |
| `progress_note` | text | required |
| `blockers_note` / `next_focus` | text | 可选 |
| `author` | relation → members | required；前端默认 = KR.owner |

校验 hook：`pb_hooks/kr_checkin_validation.pb.js`。通过 `e.requestInfo().body` 判断「用户是否显式传字段」，避开 PB number 字段默认 0 与「人填 0」无法区分的歧义。

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
- `goalops_objectives_create` — `name`+`owner` 必填，含 `definition / start_date / due_date / progress_percent / out_of_scope / risk_level / current_blockers_summary / display_code`
- `goalops_objectives_update` — **仅暴露以下字段**：`name / definition / display_code / due_date / start_date / progress_percent / status / priority / risk_level / owner / out_of_scope / current_blockers_summary`
- `goalops_objectives_delete` — 级联

> ⚠️ **`phase_timeline` / `success_criteria` / `next_actions` 不在 update 里**。前两者必须通过 PB Admin UI 手改；`next_actions` 用下面的专用工具。

### Tasks
- `goalops_tasks_list / get / create / update / delete`
- `update` 支持 `key_result: null` / `assignee: null` 显式清空
- `predecessor_ids` 是 string 数组

### Key Results
- `goalops_key_results_list / get / create / update / delete`
- `update` 翻 `is_completed` 即可标记完成（仅 checkbox 类）
- **v1.0 新增**：`kr_type / start_value / target_value / unit / direction / contributors` 字段；`expand=derived` 透传 `/api/goalops/key_results/:id/derived` 拼到响应里

### KR Check-ins **v1.0**
- `goalops_checkins_list / get / create / update / delete`
- `list` 用 `key_result_id` 过滤，默认排序 `-checkin_date`
- `create` 度量字段三选一：metric→`current_value`，checkbox→`is_completed`，milestone→`progress_percent`。混填后端会拒（400）
- 未传 `status_signal` 时按 confidence 自动派生

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

**v1.0 起进度算法**（前端 `recomputeObjectiveProgressFromKeyResults`）：
- checkbox KR → `is_completed` 折 100 / 0
- milestone KR → 最近一条 check-in 的 `progress_percent`（无则 0）
- metric KR → derived `score * 100`（无则 0）

每条已命名 KR 平均权重，取均值四舍五入。

### 配方 5 · 录 KR check-in **v1.0**

```text
1. goalops_key_results_get  expand=derived           → 看现状（latest_value/score/confidence）
2. goalops_checkins_create                            → 写一条快照
3. （可选）goalops_objectives_update progress_percent  → 同步 objective 总进度
```

- metric KR 的 check-in 一定要带 `current_value`；混入 `is_completed/progress_percent` 会 400
- `confidence` 1–10；不传 `status_signal` 时自动派生
- `checkin_date` 必须 ≤ 今天

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

### 7. PB v0.23 中 number/bool 字段服务端默认 0/false，无法区分「人填 0」
- 现象：metric KR 写 check-in 时未传 `current_value`，PB 静默存 0，hook 看到的 `record.get('current_value')` 也是 0
- 解决：在 hook 里用 `e.requestInfo().body` 检查 key 是否被显式传入，再决定是否报错
- 已应用于 `pb_hooks/kr_checkin_validation.pb.js` 与 `kr_type_validation.pb.js`

### 8. PB hooks goja 引擎：顶层函数不会透出到 routerAdd / onXxx 回调闭包
- 现象：`routerAdd('GET', ..., (e) => handle(e))` + 同文件 `function handle(e) { ... }` 会抛 `ReferenceError: handle is not defined`
- 解决：把校验逻辑直接内联到回调函数体里；或用 `const fn = (e) => { ... }` + `onRecordCreateRequest(fn, ...)` 把命名函数声明为 const 表达式（这种闭包能透出）

### 9. PB v0.23 起新建 collection 不再自动带 created/updated
- 现象：`findRecordsByFilter(..., '-created', ...)` 抛 `invalid sort field "created"`
- 解决：在迁移里显式 `new AutodateField({name:'created', onCreate:true})` + `new AutodateField({name:'updated', onCreate:true, onUpdate:true})`
- 老存量记录的 `created/updated` 会为空字符串；只有新写入会自动填

---

## 文件指路

| 想干什么 | 看哪里 |
|---|---|
| Schema 总览 | `backend/pocketbase/COLLECTIONS.md` |
| MCP 工具实现 | `mcp/src/tools/{objectives,tasks,keyResults,checkins,blockers,nextActions}.ts` |
| Check-in 前端 | `src/features/checkins/{CheckinForm,CheckinTimeline,KRCheckinPanel,service}.{tsx,ts}` |
| PB hooks（校验 + derived endpoint） | `backend/pocketbase/pb_hooks/kr_*.pb.js` |
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
