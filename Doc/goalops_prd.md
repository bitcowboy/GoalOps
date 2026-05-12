# GoalOps PRD

版本：v0.4  
日期：2026-05-12  
状态：当前唯一产品需求文档

## 1. 产品定位

GoalOps 是面向部门内部的轻量级目标与执行管理工具，用于把部门目标、关键结果、任务、卡点和人员占用放在同一个管理闭环中。

当前版本聚焦最小化 OKR：目标、KR、任务、卡点和人员占用。

## 2. MVP 闭环

```text
Objective 目标
  -> Key Result 关键结果（Checkbox 完成项）
  -> Task 任务
  -> Member Capacity 人员占用（由未完成任务预计工时计算）
```

MVP 要回答：

1. 当前有哪些目标，哪些有风险或阻塞。
2. 每个目标的 KR 完成情况如何。
3. 哪些任务支撑某个目标或 KR。
4. 哪些任务被前置任务阻塞。
5. 每个人承担了哪些任务，预计工时是否超出可用工时。

## 3. 不做范围

1. 实时多人协同编辑。
2. 复杂权限系统。
3. Jira / 飞书 / Notion 双向同步。
4. AI 自动决策。
5. 企业级报表中心。
6. 多部门、多组织、多租户管理。

## 4. 页面结构

```text
/                              首页总览
/objectives                    目标列表
/objectives/new                创建目标
/objectives/:id                目标详情
/objectives/:id/edit           编辑目标
/tasks                         任务列表
/tasks/new                     创建任务
/tasks/:id/edit                编辑任务
/people                        人员占用看板
/people/manage                 团队成员管理
/settings                      基础设置
```

## 5. 数据模型

### 5.1 Objective

```ts
type ObjectiveStatus =
  | "not_started"
  | "explore_plan"
  | "in_progress"
  | "paused"
  | "in_review"
  | "done"
  | "cancelled";

type Priority = "P0" | "P1" | "P2" | "P3";

interface Objective {
  id: string;
  name: string;
  definition?: string;
  oneSentenceDefinition?: string;
  ownerId: string;
  status: ObjectiveStatus;
  priority: Priority;
  startDate?: string;
  dueDate?: string;
  background?: string; // 目标描述
  outOfScope?: string[];
  currentBlockersSummary?: string;
  nextActions?: Array<{ suggestion: string; priority: Priority; suggestionDate: string }>;
  progressPercent?: number;
}
```

目标进度优先由 KR Checkbox 完成率计算；无 KR 时可使用手动 `progressPercent`。

### 5.2 KeyResult

```ts
interface KeyResult {
  id: string;
  objectiveId: string;
  name: string;
  isCompleted: boolean;
  ownerId?: string;
  note?: string;
  sortOrder?: number;
}
```

不使用数值型 KR 字段：`currentValue`、`targetValue`、`unit`、`score`、`weight`、`confidence`。

### 5.3 Task

```ts
type TaskStatus = "pending" | "in_progress" | "deliver" | "review" | "done";

interface Task {
  id: string;
  objectiveId: string;
  keyResultId?: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string;
  predecessorIds: string[];
  estimateHours?: number;
  dueDate?: string;
}
```

任务必须绑定 Objective，可以选择绑定同一目标下的 KR。若前置任务未 `done`，任务列表应显示依赖风险。

### 5.4 Member

```ts
interface Member {
  id: string;
  name: string;
  role: string;
  team?: string;
  weeklyAvailableHours: number;
  status: "active" | "inactive";
}
```

人员占用率：

```text
人员占用率 = 未完成任务预计工时 / 每周可用工时
```

## 6. 功能要求

### 6.1 目标管理

- 查看目标列表。
- 查看目标详情。
- 创建目标。
- 编辑目标。
- 设置目标负责人、状态、优先级、起止日期、目标描述、风险和下一步行动。
- 在目标表单中维护 KR。
- 目标进度使用 KR 完成率优先计算。

### 6.2 KR 管理

- 在目标下创建 KR。
- 编辑 KR 名称、负责人、备注。
- 勾选 / 取消勾选 KR 完成状态。
- 删除 KR。
- 按 `sortOrder` 展示。

### 6.3 任务管理

- 查看任务列表。
- 创建任务。
- 编辑任务。
- 任务必须绑定目标。
- 任务可选绑定 KR。
- 设置负责人、状态、优先级、前置任务、截止日期、预计工时。
- 支持按目标、KR、负责人、状态、优先级、截止日期筛选。
- 支持只看阻塞任务。
- 支持依赖风险提醒。

### 6.4 人员管理

- 查看人员占用看板。
- 新增成员。
- 编辑成员。
- 启用 / 停用成员。
- 搜索成员。
- 设置角色、团队和每周可用工时。
- 人员占用只基于目标任务预计工时计算。

### 6.5 首页

- 展示目标总数、活跃目标、阻塞目标、KR 平均完成率、高优任务和团队人数。
- 展示目标卡片或目标表格。
- 展示风险与阻塞。
- 展示基于 KR、任务和阻塞的行动建议。

## 7. 后端集合

PocketBase 集合：

```text
members
objectives
key_results
tasks
blockers
```

## 8. 技术方案

```text
React + Vite + TypeScript + Tailwind CSS + Zustand + PocketBase
```

前端应通过服务/领域函数封装 PocketBase 访问，页面组件不直接承载复杂计算规则。

## 9. 验收标准

1. 打开首页可看到目标、KR、任务和阻塞概览。
2. 创建和编辑目标复用同一个 `GoalFormPage`。
3. 目标详情可勾选 KR，并自动更新目标进度。
4. 任务列表可筛选、可查看 KR 关联和依赖风险。
5. `/tasks/new` 和 `/tasks/:id/edit` 可创建和编辑任务。
6. `/people` 可看到成员任务占用。
7. `/people/manage` 可新增、编辑、启用和停用成员。
