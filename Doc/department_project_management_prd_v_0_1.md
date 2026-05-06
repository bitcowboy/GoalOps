# 部门项目管理工具 PRD v0.1

## 1. 项目概述

### 1.1 项目名称

暂定名称：**DeptOps / 目标舱 / Department GoalOps**

本项目是一个面向部门内部使用的轻量级项目管理工具，用于管理部门级目标、目标下任务、目标详情、交付件、卡点、人员占用和会议杂事。

它不是传统意义上的 To-do List，也不是完整替代 Jira / 飞书 / Notion 的复杂协作平台，而是一个围绕“目标 - 交付件 - 任务 - 人员占用”建立管理闭环的部门管理工具。

### 1.2 产品定位

本工具面向部门负责人、项目负责人和团队成员，用于解决以下问题：

1. 部门当前有多个目标并行推进，但整体状态不直观。
2. 团队成员都很忙，但很难判断忙在目标上、任务上、会议上，还是被杂事吞没。
3. 任务很多，但任务和目标之间的关系不清晰。
4. 项目卡点、风险和异常分散在会议、群聊和个人脑子里，缺乏统一展示。
5. 缺少一个可以快速回答“现在最该推进什么”的管理视图。

### 1.3 MVP 目标

MVP 的目标是做出一个可本地运行或轻量部署的 Web 工具，实现以下闭环：

```text
创建部门目标
  ↓
定义目标详情、交付件、核心文档
  ↓
拆分目标下任务
  ↓
配置任务负责人、状态、前置任务和排期
  ↓
人员页自动汇总每个人的占用情况
  ↓
首页自动展示目标进度、风险和行动建议
```

### 1.4 第一阶段不做什么

MVP 阶段暂不做以下复杂功能：

1. 复杂权限系统。
2. 实时多人协同编辑。
3. 完整甘特图。
4. 飞书 / Jira / Notion 双向同步。
5. 复杂审批流。
6. AI 自动决策。
7. 企业级报表中心。
8. 多部门、多组织、多租户管理。

MVP 先完成核心数据流和页面闭环。否则这个项目管理工具本身会变成一个需要被项目管理的项目，简称人类递归惨案。

---

## 2. 用户角色

### 2.1 部门负责人

主要诉求：

1. 看清部门当前目标状态。
2. 识别风险、延期、人员过载和资源冲突。
3. 确定每周重点行动。
4. 追踪目标进度和核心交付件。

核心页面：

- 部门整体看板
- 目标详情页
- 人员页

### 2.2 项目 / 目标负责人

主要诉求：

1. 维护目标定义、成功标准和交付件。
2. 拆分任务并分配负责人。
3. 识别当前卡点。
4. 推进目标进入下一阶段。

核心页面：

- 目标详情页
- 任务列表

### 2.3 团队成员

主要诉求：

1. 查看自己负责的任务。
2. 了解任务所属目标和优先级。
3. 确认前置依赖、截止日期和验收标准。
4. 看到自己的时间占用情况。

核心页面：

- 任务列表
- 人员页

---

## 3. 核心概念

### 3.1 目标 Objective

目标是部门管理的一级对象。

每个目标代表一个明确的部门级工作方向，例如：

- AI 创作大赛小游戏开发平台
- 剑网3 智能客服
- VLA 模型训练
- RTS 项目原型验证

目标必须包含：

- 名称
- 定义
- 进度
- 状态
- 负责人
- 优先级
- 起止时间
- 当前卡点
- 行动建议

### 3.2 交付件 Deliverable

交付件是目标的结果物。

任务只是过程，交付件才是成果。MVP 需要单独建模交付件，避免团队用“我做了很多任务”冒充“我交付了结果”。这招太常见了，像办公室里的灰尘一样顽强。

交付件示例：

- 可玩原型 Demo
- PRD 文档
- 技术方案
- 数据集
- 模型评估报告
- 内测版本
- 上线功能

### 3.3 任务 Task

任务是目标下的执行动作。

每个任务必须隶属于一个目标。任务可以有 0 个或多个前置任务。

任务状态包括：

```text
未开始 → 进行中 → 交付 → 验收 → 完结
```

### 3.4 人员 Member

人员用于表示团队成员、负责人、参与人和资源占用。

人员页重点不是监控人，而是观察资源分配、会议消耗、任务过载和上下文切换风险。

### 3.5 杂事 / 会议 MiscWork

会议、临时需求、跨部门沟通、支持救火等非目标任务也必须进入系统，并计入人员占用。

否则管理者会看到一种美丽幻觉：所有人理论上都有空，实际都在开会。

---

## 4. 页面结构

系统包含 4 个主页面：

```text
/                          部门整体看板
/objectives/:id             目标详情页
/tasks                      任务列表
/people                     人员页
```

可选页面：

```text
/settings                   基础设置
```

---

# 5. 页面一：部门整体看板

## 5.1 页面目标

部门整体看板用于展示部门当前整体运行状态。

用户打开首页后，应当能够快速回答：

1. 部门现在有几个主要目标？
2. 哪些目标正常，哪些目标有风险？
3. 哪些目标进度异常？
4. 本周有哪些高优任务？
5. 谁可能过载？
6. 哪些会议和杂事正在占用团队时间？
7. 系统建议本周优先处理什么？

## 5.2 页面模块

### 5.2.1 顶部导航栏

包含：

- 当前部门名称，例如：AI 创新中心
- 全局搜索框
- 通知入口
- 当前用户头像和名称

搜索框占位文案：

```text
搜索目标、任务、文档或成员
```

### 5.2.2 左侧导航栏

导航项：

```text
概览
目标
项目
任务
讨论
文档
资源
报表
团队
设置
```

MVP 阶段可以只实现以下实际可用入口：

```text
概览
目标
任务
团队
设置
```

其他入口可以显示为占位。

### 5.2.3 顶部数据概览卡片

展示以下指标：

| 字段 | 示例 | 说明 |
|---|---|---|
| 当前周期 | 2025年5月 第3周 | 当前统计周期 |
| 目标总数 | 8 | 当前未完结目标数量 |
| 正常目标 | 5 | 状态正常的目标数量 |
| 风险目标 | 2 | 状态为风险或阻塞的目标数量 |
| 高优任务 | 14 | P0 / P1 且未完结任务数量 |
| 团队占用率 | 87% | 团队整体分配工时 / 可用工时 |

### 5.2.4 目标看板区域

以卡片形式展示目标。

每张目标卡片字段：

| 字段 | 类型 | 示例 |
|---|---|---|
| 目标名称 | 文本 | AI 创作大赛小游戏开发平台 |
| 一句话定义 | 文本 | 搭建面向创作者的 AI 驱动小游戏开发平台 |
| 进度 | 百分比 | 68% |
| 健康状态 | 枚举 | 正常 / 风险 / 阻塞 / 暂停 |
| 优先级 | 枚举 | P0 / P1 / P2 / P3 |
| 负责人 | 人员 | 张雨薇 |
| 当前卡点 | 文本 | AI 生成资源成本过高 |
| 下一步动作 | 文本 | 完成资源生成服务降本方案 |
| 最近更新时间 | 时间 | 今天 10:24 |

交互：

- 点击目标卡片进入目标详情页。
- 支持按状态筛选。
- 支持按优先级筛选。

### 5.2.5 风险与异常区域

集中展示系统发现的异常。

风险类型：

```text
目标延期
目标无负责人
前置任务阻塞
人员过载
目标无交付件
任务逾期
目标长期无更新
高优任务未启动
```

字段：

| 字段 | 说明 |
|---|---|
| 风险类型 | 例如“目标延期” |
| 关联对象 | 目标 / 任务 / 人员 |
| 风险描述 | 简要说明 |
| 严重程度 | 低 / 中 / 高 / 致命 |
| 更新时间 | 发现时间 |

### 5.2.6 杂事 / 会议区域

展示非目标型事项。

字段：

| 字段 | 说明 |
|---|---|
| 类型 | 会议 / 杂事 / 临时需求 / 支持 |
| 事项名称 | 例如“VLA 训练周同步” |
| 参与人 | 人员列表 |
| 时间 | 日期和时长 |
| 是否占用产能 | 是 / 否 |

### 5.2.7 本周行动建议区域

展示系统根据规则生成的管理建议。

示例：

```text
1. 优先处理 VLA 模型训练的算力排队问题，否则影响 P0 目标进度。
2. 剑网3 智能客服当前 FAQ 覆盖不足，建议本周优先补齐知识库。
3. 刘凯本周占用率 96%，建议拆分 RTS 原型中非关键任务。
4. AI 创作平台已有 2 个交付件进入验收，建议尽快安排评审。
```

MVP 阶段行动建议可以用规则生成，不依赖大模型。

---

# 6. 页面二：目标详情页

## 6.1 页面目标

目标详情页用于展示单个目标的完整上下文。

用户进入目标详情页后，应当能看到：

1. 这个目标是什么。
2. 为什么做。
3. 做到什么程度算完成。
4. 当前进度如何。
5. 谁负责。
6. 关键文档在哪里。
7. 交付件有哪些。
8. 当前卡点是什么。
9. 有哪些关联任务。
10. 下一步应该做什么。

## 6.2 页面模块

### 6.2.1 顶部目标摘要

字段：

| 字段 | 示例 |
|---|---|
| 目标名称 | RTS 项目原型验证 |
| 优先级 | P1 |
| 状态 | 进行中 |
| 总体进度 | 55% |
| 负责人 | 刘凯 |
| 起止时间 | 2025.04.20 - 2025.06.30 |
| 剩余天数 | 41 天 |

操作按钮：

```text
编辑目标
更多
返回目标列表
```

### 6.2.2 目标定义卡片

包含四个子区域：

#### 背景 / 价值

说明为什么要做。

示例：

```text
RTS 赛道竞争激烈，AI 指挥官将是差异化核心。通过原型验证，我们能够验证核心玩法闭环与 AI 指挥官策略有效性，降低立项不确定性。
```

#### 成功标准

示例：

```text
- 完成可玩原型 Demo，包含核心玩法闭环。
- AI 指挥官在小规模对战中胜率 ≥ 45%。
- 完成 2 轮内部用户可玩性测试，NPS ≥ 30。
- 产出验证报告，给出立项建议。
```

#### 不属于本目标范围

示例：

```text
- 美术品质打磨与完整美术资源制作。
- 大规模联机与服务器压力测试。
- 商业化系统与长期运营方案设计。
- 正式版本多平台适配。
```

这个字段很重要。没有边界的目标最后都会变成许愿池。

### 6.2.3 阶段进展区域

阶段建议：

```text
需求定义 → 原型开发 → 内部验证 → 交付上线
```

字段：

| 字段 | 说明 |
|---|---|
| 当前阶段 | 当前所处阶段 |
| 阶段状态 | 已完成 / 进行中 / 待开始 |
| 阶段目标 | 当前阶段要达成什么 |
| 阶段进度 | 百分比 |
| 阶段起止时间 | 日期 |
| 剩余天数 | 数字 |

### 6.2.4 核心文档区域

表格字段：

| 字段 | 说明 |
|---|---|
| 文档名称 | 文档标题 |
| 类型 | PRD / 技术方案 / 设计文档 / 测试文档 |
| 状态 | 草稿 / 进行中 / 已评审 / 已废弃 |
| 负责人 | 文档负责人 |
| 更新时间 | 最近更新时间 |
| 链接 | 外部文档地址，可选 |

### 6.2.5 核心交付件区域

表格字段：

| 字段 | 说明 |
|---|---|
| 交付件名称 | 例如“可玩原型 Demo v0.5” |
| 状态 | 未开始 / 进行中 / 待验收 / 已交付 |
| 计划完成 | 日期 |
| 负责人 | Owner |
| 验收标准摘要 | 简短说明 |

### 6.2.6 当前卡点区域

表格字段：

| 字段 | 说明 |
|---|---|
| 问题描述 | 卡点说明 |
| 严重度 | 低 / 中 / 高 / 致命 |
| 类型 | 技术 / 资源 / 决策 / 流程 / 协作 |
| 影响 | 影响进度、质量、成本或范围 |
| 负责人 | 谁处理 |
| 预期解决时间 | 日期 |

### 6.2.7 关联任务区域

展示该目标下的任务。

字段：

| 字段 | 说明 |
|---|---|
| 任务名称 | 任务标题 |
| 状态 | 未开始 / 进行中 / 交付 / 验收 / 完结 |
| 负责人 | 任务负责人 |
| 优先级 | P0 / P1 / P2 / P3 |
| 依赖 | 前置任务 |
| 计划完成 | 日期 |

### 6.2.8 行动建议区域

展示针对该目标的建议。

示例：

```text
1. 聚焦性能优化优先级：AI 指挥官性能波动影响体验，建议集中资源优先解决。
2. 补充测试用例与数据：当前验证样本不足，建议补充高复杂度对局场景。
3. 明确内部测试范围：建议确定测试用户画像与核心测试点。
4. 关注里程碑风险：原型与 MVP 交付集中在 5 月下旬，存在排期压力。
```

---

# 7. 页面三：任务列表

## 7.1 页面目标

任务列表用于集中展示所有目标下的任务。

用户应当能够快速看到：

1. 哪些任务属于哪个目标。
2. 哪些任务正在进行中。
3. 哪些任务已经交付但未验收。
4. 哪些任务被前置任务阻塞。
5. 哪些任务即将到期或已经逾期。
6. 哪些任务是高优先级。
7. 哪些任务没有绑定目标。

## 7.2 页面模块

### 7.2.1 顶部指标卡

| 指标 | 示例 |
|---|---|
| 总任务数 | 86 |
| 进行中 | 28 |
| 待验收 | 9 |
| 已阻塞 | 6 |
| 本周到期 | 12 |

### 7.2.2 筛选和搜索区

包含：

```text
搜索任务名称、目标或描述
所属目标
负责人
状态
优先级
截止日期
只看阻塞任务
只看我的任务
```

### 7.2.3 任务表格

字段：

| 字段 | 说明 |
|---|---|
| 所属目标 | 任务绑定的目标 |
| 任务名称 | 任务标题 |
| 状态 | 未开始 / 进行中 / 交付 / 验收 / 完结 |
| 负责人 | 主负责人 |
| 前置任务 | 依赖任务 |
| 优先级 | P0 / P1 / P2 / P3 |
| 截止日期 | 计划完成时间 |
| 预计工时 | 用于人员占用计算 |
| 风险 | 低 / 中 / 高 |

### 7.2.4 任务状态流转

任务状态流转如下：

```text
未开始 → 进行中 → 交付 → 验收 → 完结
```

状态定义：

| 状态 | 含义 |
|---|---|
| 未开始 | 尚未启动 |
| 进行中 | 正在执行 |
| 交付 | 执行人认为已经完成，等待验收 |
| 验收 | 验收人正在检查质量 |
| 完结 | 已确认完成 |

### 7.2.5 前置任务逻辑

规则：

```text
如果任务存在前置任务，且前置任务未完结，则当前任务标记为“被阻塞”。
如果任务是多个任务的前置任务，则标记为“关键路径任务”。
如果前置任务延期，则依赖它的后续任务标记为“依赖风险”。
```

### 7.2.6 依赖风险提醒

展示被前置任务阻塞的任务。

字段：

| 字段 | 说明 |
|---|---|
| 任务 | 被阻塞任务 |
| 所属目标 | 对应目标 |
| 阻塞原因 | 具体前置任务 |
| 阻塞时长 | 阻塞多久 |
| 影响 | 高 / 中 / 低 |

### 7.2.7 孤儿任务提醒

展示未绑定任何目标的任务。

MVP 中任务原则上必须绑定目标，但可以允许系统识别历史遗留或临时创建的孤儿任务。

字段：

| 字段 | 说明 |
|---|---|
| 任务名称 | 任务标题 |
| 问题描述 | 未关联任何目标 |
| 创建时间 | 时间 |
| 负责人 | 人员 |

---

# 8. 页面四：人员页

## 8.1 页面目标

人员页用于展示团队成员的工作负载、时间分配和风险状态。

用户应当能够看到：

1. 每个人本周负责什么目标。
2. 每个人当前任务数。
3. 每个人本周可用工时和已分配工时。
4. 每个人被任务、会议、杂事分别占用了多少。
5. 谁过载。
6. 谁会议过多。
7. 谁同时参与太多目标。
8. 哪些关键路径依赖单点人员。

## 8.2 页面模块

### 8.2.1 顶部指标卡

| 指标 | 示例 |
|---|---|
| 团队人数 | 12 |
| 平均占用率 | 74% |
| 过载成员 | 2 |
| 关键路径负责人 | 3 |
| 本周会议时长 | 18.6h |

### 8.2.2 成员列表 / 时间轴表格

字段：

| 字段 | 说明 |
|---|---|
| 成员信息 | 姓名、头像、角色 |
| 当前主要目标 | 本周主要投入目标 |
| 当前任务数 | 当前任务数量 |
| 时间分配 | 目标任务 / 会议 / 杂事 |
| 占用率 | 已分配工时 / 可用工时 |
| 周一到周日 | 简化时间轴 |
| 风险状态 | 正常 / 过载 / 分散 / 会议过载 |

### 8.2.3 人员占用计算

公式：

```text
本周占用率 = 本周已分配工时 / 本周可用工时

本周已分配工时 = 任务预计工时 + 会议时长 + 杂事预计工时
```

默认每人每周可用工时：

```text
40h
```

可在人员配置中修改。

### 8.2.4 占用率状态规则

```text
0% - 50%：低占用
50% - 85%：正常
85% - 110%：偏满
110% 以上：过载
```

MVP 页面可使用以下展示：

```text
绿色：正常
橙色：偏满
红色：过载
灰色：低占用
```

### 8.2.5 风险洞察

展示以下风险：

```text
人员过载
会议过载
多目标分散
关键人员风险
可释放工时
资源建议
```

示例：

```text
人员过载：张雨薇 92%，刘凯 96%。
会议过载：陈子墨本周会议占比 18.2%。
多目标分散：王皓同时参与 3 个 P0/P1 目标。
关键人员风险：刘凯同时负责 RTS 目标核心路径任务。
```

---

# 9. 数据模型

## 9.1 Objective

```ts
type ObjectiveStatus =
  | "not_started"
  | "in_progress"
  | "at_risk"
  | "blocked"
  | "paused"
  | "completed";

type Priority = "P0" | "P1" | "P2" | "P3";

interface Objective {
  id: string;
  name: string;
  definition: string;
  background?: string;
  successCriteria?: string;
  outOfScope?: string;

  progressPercent: number;
  phase?: string;
  status: ObjectiveStatus;
  priority: Priority;

  ownerId: string;
  memberIds: string[];

  startDate?: string;
  dueDate?: string;

  currentBlockers?: string[];
  actionSuggestions?: string[];

  createdAt: string;
  updatedAt: string;
}
```

## 9.2 Task

```ts
type TaskStatus =
  | "not_started"
  | "in_progress"
  | "delivered"
  | "in_review"
  | "completed";

interface Task {
  id: string;
  objectiveId: string;

  name: string;
  description?: string;

  status: TaskStatus;
  priority: Priority;

  ownerId: string;
  participantIds?: string[];

  prerequisiteTaskIds: string[];

  startDate?: string;
  dueDate?: string;

  estimatedHours?: number;
  actualHours?: number;

  deliverableId?: string;
  reviewerId?: string;
  acceptanceCriteria?: string;

  createdAt: string;
  updatedAt: string;
}
```

## 9.3 Deliverable

```ts
type DeliverableStatus =
  | "not_started"
  | "in_progress"
  | "ready_for_review"
  | "delivered"
  | "discarded";

type DeliverableType =
  | "demo"
  | "document"
  | "model"
  | "dataset"
  | "tool"
  | "report"
  | "feature"
  | "other";

interface Deliverable {
  id: string;
  objectiveId: string;

  name: string;
  definition: string;
  type: DeliverableType;

  ownerId: string;
  relatedTaskIds: string[];

  status: DeliverableStatus;
  dueDate?: string;
  acceptanceCriteria?: string;

  createdAt: string;
  updatedAt: string;
}
```

## 9.4 CoreDocument

```ts
type DocumentStatus =
  | "draft"
  | "in_review"
  | "confirmed"
  | "deprecated";

type DocumentType =
  | "prd"
  | "tech_design"
  | "game_design"
  | "meeting_notes"
  | "evaluation_report"
  | "review_doc"
  | "data_spec"
  | "other";

interface CoreDocument {
  id: string;
  objectiveId: string;

  title: string;
  type: DocumentType;
  url?: string;

  ownerId?: string;
  status: DocumentStatus;

  createdAt: string;
  updatedAt: string;
}
```

## 9.5 Blocker

```ts
type BlockerType =
  | "unclear_requirement"
  | "technical_risk"
  | "resource_shortage"
  | "schedule_conflict"
  | "external_dependency"
  | "cross_team_collaboration"
  | "decision_pending"
  | "data_missing"
  | "unclear_acceptance"
  | "other";

type Severity = "low" | "medium" | "high" | "critical";

type BlockerStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "accepted";

interface Blocker {
  id: string;
  objectiveId: string;
  relatedTaskIds?: string[];

  title: string;
  type: BlockerType;
  severity: Severity;
  description: string;

  impact?: string;
  ownerId?: string;
  expectedResolveDate?: string;

  status: BlockerStatus;
  actionSuggestion?: string;

  createdAt: string;
  updatedAt: string;
}
```

## 9.6 Member

```ts
interface Member {
  id: string;

  name: string;
  role: string;
  team?: string;
  avatarUrl?: string;

  weeklyAvailableHours: number;

  createdAt: string;
  updatedAt: string;
}
```

## 9.7 MiscWork

```ts
type MiscWorkType =
  | "meeting"
  | "ad_hoc_request"
  | "cross_team_sync"
  | "admin"
  | "recruiting"
  | "support"
  | "firefighting"
  | "review"
  | "other";

interface MiscWork {
  id: string;

  title: string;
  type: MiscWorkType;

  relatedObjectiveId?: string;

  participantIds: string[];

  startTime?: string;
  endTime?: string;
  estimatedHours?: number;

  consumesCapacity: boolean;

  notes?: string;

  createdAt: string;
  updatedAt: string;
}
```

---

# 10. 计算规则

## 10.1 目标进度

MVP 支持两种方式：

### 手动进度

用户手动填写目标进度百分比。

### 自动进度

根据交付件或任务计算。

建议 MVP 默认使用手动进度，后续增加自动计算。

可选自动规则：

```text
目标进度 = 已完结任务数 / 总任务数
```

或：

```text
目标进度 = 已交付交付件数 / 总交付件数
```

更推荐后者，因为交付件比任务更接近真实成果。

## 10.2 目标健康状态

规则：

```text
如果目标状态手动设置为 blocked，则显示阻塞。
如果目标 dueDate < 今天 且 progressPercent < 100，则标记延期风险。
如果 P0/P1 目标没有负责人，则标记严重风险。
如果目标没有交付件，则标记目标不清晰。
如果目标下所有任务 7 天内无更新，则标记停滞风险。
```

## 10.3 任务阻塞判断

规则：

```text
如果任务的 prerequisiteTaskIds 中存在未 completed 的任务，则任务为 blocked。
```

## 10.4 关键路径任务判断

规则：

```text
如果一个任务被 2 个以上任务作为前置依赖，则标记为关键路径任务。
如果一个任务属于 P0 / P1 目标，且它被后续任务依赖，也标记为关键路径任务。
```

## 10.5 人员占用率

公式：

```text
人员本周占用率 = 本周分配总工时 / 本周可用工时
```

本周分配总工时：

```text
任务预计工时 + 会议时长 + 杂事预计工时
```

---

# 11. MVP 功能清单

## 11.1 必须实现

### 目标管理

- 创建目标
- 编辑目标
- 删除目标
- 查看目标列表
- 查看目标详情
- 设置目标状态
- 设置目标优先级
- 设置目标负责人
- 设置目标进度
- 设置起止时间

### 任务管理

- 创建任务
- 编辑任务
- 删除任务
- 查看任务列表
- 任务绑定目标
- 设置任务状态
- 设置负责人
- 设置前置任务
- 设置截止日期
- 设置预计工时
- 筛选任务

### 人员管理

- 创建人员
- 编辑人员
- 查看人员列表
- 设置角色
- 设置每周可用工时
- 查看人员占用率

### 交付件管理

- 创建交付件
- 编辑交付件
- 交付件绑定目标
- 设置交付件状态
- 设置负责人
- 设置验收标准

### 卡点管理

- 创建卡点
- 编辑卡点
- 绑定目标
- 设置严重程度
- 设置负责人
- 设置预期解决时间

### 杂事 / 会议管理

- 创建杂事 / 会议
- 设置参与人
- 设置时间和工时
- 设置是否占用产能
- 可选绑定目标

### 数据展示

- 首页目标卡片
- 首页风险聚合
- 首页行动建议
- 任务列表
- 人员占用页
- 目标详情页

## 11.2 可以后做

- 用户登录
- 权限控制
- AI 总结
- AI 风险识别
- 周报导出
- 外部文档同步
- 通知系统
- 甘特图
- 看板拖拽

---

# 12. UI 风格要求

## 12.1 整体风格方向

UI 采用 **Nothing-inspired design language**，整体视觉应区别于传统蓝白 SaaS 后台。

关键词：

```text
黑白灰主色
高对比
点阵 / 像素感细节
透明玻璃质感
细线框
留白克制
功能性红色点缀
模块化卡片
仪表盘式信息组织
科技硬件感
```

整体观感应接近：

```text
不是传统企业管理后台
不是花哨游戏运营平台
而是一个冷静、精密、带硬件产品气质的部门控制台
```

也就是：少一点“互联网公司蓝色按钮海洋”，多一点“实验室里拿来指挥小型空间站的控制面板”。

## 12.2 视觉原则

### 黑白灰为主体

主色不要使用大面积蓝色。页面主体应以黑、白、灰构成。

建议色彩：

```text
背景主色：#F6F6F3 / #FAFAF7
主文字：#111111
次级文字：#666666
弱文字：#999999
边框：#D9D9D4
深色区域：#0B0B0B
卡片背景：rgba(255, 255, 255, 0.72)
强调红：#FF2D2D
安全绿：#1E9E58
警告橙：#F59E0B
```

红色只作为功能性强调使用，例如：

```text
严重风险
阻塞
通知红点
P0 标记
关键路径警告
```

不要把红色用成装饰色。Nothing 风格的红色应该像警示灯，不是春节横幅。

### 点阵 / Glyph 元素

UI 中可以加入少量点阵元素，用于增强识别度。

可用于：

```text
页面标题下方的点阵纹理
Metric Card 的背景纹理
进度条刻度
风险等级指示
空状态插图
Logo / 产品名辅助图形
```

示例：

```text
················
·· GOAL OPS ····
················
```

但不要滥用。点阵是气质，不是把页面做成电子表坏掉。

### 半透明卡片与细边框

卡片应使用半透明白色或浅灰背景，配合细边框。

建议：

```text
background: rgba(255, 255, 255, 0.72)
border: 1px solid rgba(0, 0, 0, 0.08)
backdrop-filter: blur(16px)
border-radius: 20px
box-shadow: 0 12px 30px rgba(0, 0, 0, 0.04)
```

卡片不要过度彩色化。状态信息通过小型 Badge、图标、红点、细线来表达。

### 细线与分割

优先使用细线、虚线、刻度线，而不是大色块。

适合用于：

```text
表格分割线
时间轴网格
任务依赖线
进度刻度
人员占用条
目标阶段线
```

### 字体风格

推荐字体：

```text
中文：Inter / Noto Sans SC / 思源黑体
数字：Space Grotesk / IBM Plex Mono / JetBrains Mono
点阵标题：可用 CSS letter-spacing + uppercase 模拟
```

数字、进度、占用率等关键指标建议使用等宽或几何感更强的字体。

示例：

```text
87%
P0
05.12 - 05.18
TASK-024
```

这些数字信息应该像设备读数，而不是普通后台 KPI。人类看到数字就会产生控制幻觉，至少让幻觉精致一点。

## 12.3 布局风格

整体仍使用：

```text
左侧导航栏 + 顶部导航栏 + 主内容区
```

但视觉上应更像一个控制台。

### 左侧导航

左侧导航建议采用深色 Nothing 风格：

```text
背景：#0B0B0B
文字：#F4F4F0
选中项：白色描边 / 红色小点 / 浅灰胶囊背景
图标：线性图标
```

选中状态不要用传统大蓝块。建议使用：

```text
左侧红色短线
红色圆点
白色细边框
浅灰半透明底
```

### 顶部导航

顶部导航保持克制。

包含：

```text
部门名称
全局搜索
通知
用户入口
当前周期
```

搜索框建议做成细边框胶囊，不使用厚重阴影。

### 主内容区

主内容区采用模块化卡片。

建议卡片类型：

```text
Metric Card：顶部指标
Objective Card：目标卡片
Alert Card：风险卡片
Data Table：任务表格
Timeline Grid：人员时间轴
Action Panel：行动建议
```

## 12.4 状态颜色

整体以黑白灰为主，状态色只用于识别，不用于大面积装饰。

```text
正常：绿色小点 / 细线
风险：橙色小点 / 警示描边
阻塞：红色小点 / 红色描边
暂停：灰色斜纹 / 灰色标签
进行中：黑色描边 + 动态刻度
交付：浅灰标签 + 黑色文字
验收：橙色标签
完结：绿色标签
```

优先使用小面积状态组件：

```text
Status Dot
Status Badge
Priority Pill
Risk Indicator
Progress Tick
```

## 12.5 组件设计要求

MVP 需要以下基础组件：

```text
Sidebar
Topbar
MetricCard
ObjectiveCard
StatusBadge
PriorityBadge
ProgressBar
DataTable
FilterBar
PersonCapacityRow
TimelineGrid
RiskCard
ActionSuggestionCard
ModalForm
DotMatrixLabel
GlyphDivider
CapacityRing
```

### MetricCard

MetricCard 应像硬件仪表读数。

包含：

```text
小标题
大数字
变化趋势
点阵背景 / 微弱刻度
状态红点或绿点
```

### ObjectiveCard

ObjectiveCard 使用半透明卡片 + 细边框。

包含：

```text
目标名称
优先级 Pill
状态 Dot
进度刻度条
负责人
当前卡点
下一步动作
更新时间
```

卡片顶部可以使用一条极细状态线：

```text
P0 / 阻塞：红色线
风险：橙色线
正常：黑色或绿色线
```

### ProgressBar

不要使用传统蓝色进度条。

建议采用：

```text
黑色主进度条
灰色轨道
分段刻度
关键节点红点
```

### DataTable

表格风格：

```text
白底或半透明底
细线分隔
小型状态标签
等宽数字
行 hover 使用浅灰背景
```

### TimelineGrid

人员时间轴应像排班控制台。

建议：

```text
横向日期网格
纵向人员列表
任务块使用浅灰底
会议块使用虚线边框
风险任务块使用红点或红色左边线
```

## 12.6 交互风格

交互应克制但清晰。

建议：

```text
Hover：边框变深 / 阴影略增强
Selected：红色小点 + 黑色描边
Dragging：半透明卡片浮起
Focus：黑色描边 + 红色小光标点
Loading：点阵闪烁 / 细线扫描
```

避免：

```text
大面积渐变
过度蓝色
卡通插画
复杂动效
霓虹赛博朋克
玻璃拟态过度发光
```

这不是夜店门口的 KPI 系统。

## 12.7 参考 UI 提示词

给 coding agent 或 UI generator 的提示词可以使用：

```text
Design the UI with a Nothing-inspired visual language: monochrome black-white-gray palette, precise grid layout, thin borders, translucent frosted cards, subtle dot-matrix patterns, glyph-like indicators, red functional accent dots, high contrast typography, hardware-control-panel feeling, minimal but information-dense. Avoid generic blue SaaS styling. Use restrained motion, modular cards, fine dividers, and instrument-like metric displays.
```

---

# 13. 推荐技术方案

## 13.1 推荐方案 A：React + Vite + Tailwind + Zustand + LocalStorage

适合最快速 vibe coding。

优点：

- 启动快。
- 不需要后端。
- 适合快速做交互原型。
- AI 生成代码成功率较高。

缺点：

- 数据只在本地。
- 不适合多人协作。

建议第一版使用该方案。

```text
React
Vite
TypeScript
Tailwind CSS
Zustand
LocalStorage
Recharts 或 ECharts
Lucide React Icons
```

## 13.2 推荐方案 B：SvelteKit + Tailwind + SQLite

适合你后续真正部署成内部工具。

优点：

- 代码简洁。
- 前后端一体。
- 适合小工具。

缺点：

- AI 生成复杂 UI 组件的稳定性略低于 React 生态。

## 13.3 推荐第一版路径

第一版建议：

```text
React + Vite + TypeScript + Tailwind + Zustand + LocalStorage
```

先跑通全部页面和数据流，再决定是否接 Supabase / Appwrite / SQLite。

---

# 14. 初始 Mock 数据

MVP 应内置一组模拟数据，方便打开后直接看到完整效果。

## 14.1 示例目标

```ts
const objectives = [
  {
    id: "obj-ai-creation",
    name: "AI 创作大赛小游戏开发平台",
    definition: "搭建面向创作者的 AI 驱动小游戏开发平台，降低创作门槛，激发生态活力。",
    progressPercent: 68,
    status: "in_progress",
    priority: "P0",
    ownerId: "member-zhang",
    startDate: "2025-05-01",
    dueDate: "2025-06-15"
  },
  {
    id: "obj-jx3-support",
    name: "剑网3 智能客服",
    definition: "构建大模型驱动的智能客服体系，提升问题解决率与用户满意度。",
    progressPercent: 42,
    status: "at_risk",
    priority: "P1",
    ownerId: "member-wang",
    startDate: "2025-04-20",
    dueDate: "2025-06-10"
  },
  {
    id: "obj-vla-training",
    name: "VLA 模型训练",
    definition: "训练多模态 VLA 模型，提升游戏 AI 在复杂场景下的理解与决策能力。",
    progressPercent: 33,
    status: "at_risk",
    priority: "P0",
    ownerId: "member-chen",
    startDate: "2025-04-15",
    dueDate: "2025-07-01"
  },
  {
    id: "obj-rts-prototype",
    name: "RTS 项目原型验证",
    definition: "验证核心玩法与 AI 指挥官方案，打磨可玩性，为立项提供数据支撑。",
    progressPercent: 55,
    status: "in_progress",
    priority: "P1",
    ownerId: "member-liu",
    startDate: "2025-04-20",
    dueDate: "2025-06-30"
  }
];
```

## 14.2 示例成员

```ts
const members = [
  {
    id: "member-zhang",
    name: "张雨薇",
    role: "算法工程师",
    team: "AI 创作平台组",
    weeklyAvailableHours: 40
  },
  {
    id: "member-wang",
    name: "王皓",
    role: "AI 产品经理",
    team: "智能客服组",
    weeklyAvailableHours: 40
  },
  {
    id: "member-chen",
    name: "陈子墨",
    role: "模型训练工程师",
    team: "VLA 训练组",
    weeklyAvailableHours: 40
  },
  {
    id: "member-liu",
    name: "刘凯",
    role: "AI 工程师",
    team: "RTS 原型组",
    weeklyAvailableHours: 40
  }
];
```

---

# 15. 验收标准

## 15.1 首页验收标准

- 用户可以看到目标概览指标。
- 用户可以看到目标卡片。
- 用户可以点击目标卡片进入详情页。
- 用户可以看到风险与异常列表。
- 用户可以看到杂事 / 会议列表。
- 用户可以看到本周行动建议。

## 15.2 目标详情页验收标准

- 用户可以查看单个目标的名称、定义、状态、进度、负责人、起止时间。
- 用户可以查看目标成功标准和非目标范围。
- 用户可以查看阶段进度。
- 用户可以查看核心文档。
- 用户可以查看核心交付件。
- 用户可以查看当前卡点。
- 用户可以查看关联任务。
- 用户可以查看行动建议。

## 15.3 任务列表验收标准

- 用户可以查看所有任务。
- 用户可以按目标、负责人、状态、优先级筛选。
- 用户可以搜索任务。
- 用户可以看到任务前置依赖。
- 系统可以识别被前置任务阻塞的任务。
- 系统可以识别孤儿任务。

## 15.4 人员页验收标准

- 用户可以查看成员列表。
- 用户可以看到每个人的当前目标和任务数。
- 用户可以看到每个人本周占用率。
- 用户可以看到任务、会议、杂事的时间占用。
- 用户可以看到简化时间轴。
- 系统可以识别人员过载、会议过载、多目标分散和关键人员风险。

---

# 16. Coding Agent 实施提示

下面这段可以直接作为给 coding agent 的开发指令。

```text
请基于本 PRD 开发一个桌面端优先的部门项目管理 Web MVP。

技术栈使用：React + Vite + TypeScript + Tailwind CSS + Zustand + LocalStorage。

要求：
1. 实现四个主页面：部门整体看板、目标详情页、任务列表、人员页。
2. 使用左侧导航栏 + 顶部导航栏 + 主内容区布局。
3. 内置 mock 数据，启动后可以直接看到完整示例内容。
4. 数据结构至少包含 Objective、Task、Deliverable、CoreDocument、Blocker、Member、MiscWork。
5. 支持基础增删改查，至少目标、任务、人员可以编辑。
6. 任务必须绑定目标。
7. 任务支持多个前置任务。
8. 自动计算任务阻塞状态。
9. 自动计算人员占用率。
10. 自动生成首页风险与行动建议，规则可以简单。
11. UI 风格参考现代 SaaS 产品：浅色背景、蓝色主色、圆角卡片、状态标签、进度条、表格和时间轴。
12. 代码结构清晰，组件可复用。
13. 不需要后端，不需要登录系统，数据保存在 LocalStorage。
14. 优先保证功能闭环和页面清晰，不要过度设计动画和复杂效果。
```

---

# 17. 推荐开发顺序

```text
第一步：搭建项目和基础布局
第二步：定义 TypeScript 数据模型
第三步：创建 mock 数据
第四步：实现 Zustand store
第五步：实现首页 Dashboard
第六步：实现目标详情页
第七步：实现任务列表和筛选
第八步：实现人员页和占用计算
第九步：实现基础编辑弹窗
第十步：实现 LocalStorage 持久化
第十一步：补充风险规则和行动建议
第十二步：整体 UI 打磨
```

---

# 18. 后续扩展方向

## 18.1 AI 能力

后续可以加入：

```text
AI 自动总结目标状态
AI 自动生成周报
AI 自动识别卡点类型
AI 从会议纪要提取任务
AI 从核心文档提取交付件
AI 生成行动建议
AI 识别目标定义不清晰的问题
```

## 18.2 协作能力

后续可以加入：

```text
多人账号
权限系统
评论
通知
变更记录
外部文档同步
导出周报
```

## 18.3 管理分析能力

后续可以加入：

```text
目标健康度趋势
人员占用趋势
会议成本分析
关键路径分析
延期预测
资源瓶颈分析
```

---

# 19. MVP 成功判断

这个工具的 MVP 如果能做到以下几点，就算成功：

1. 部门负责人打开首页，能在 1 分钟内知道哪些目标有风险。
2. 点进目标详情页，能看到目标定义、交付件、任务、卡点和下一步动作。
3. 打开任务列表，能看到任务和目标之间的关系，而不是一堆悬浮在宇宙里的待办事项。
4. 打开人员页，能看到团队成员的占用情况和过载风险。
5. 每周同步会可以围绕这个工具进行，而不是靠人类记忆力这种明显不可靠的生物缓存。

---

# 20. 一句话总结

本工具的核心不是“管理任务”，而是让部门围绕清晰目标、真实交付件、明确责任人和可见资源占用运转。

如果第一版能让团队少开一半无效同步会，它已经完成了对文明的一点微弱修复。

