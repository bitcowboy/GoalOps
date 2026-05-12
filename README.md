# GoalOps

GoalOps 是一个部门目标与执行管理 Web MVP，围绕最小化 OKR、任务、卡点和人员占用建立闭环。产品需求见 [最新 PRD](Doc/goalops_prd.md)。

当前版本聚焦目标、KR、任务和人员占用。

## 技术栈

| 层级 | 选型 |
| --- | --- |
| 前端 | React 19、Vite 8、TypeScript、Tailwind CSS v4、Zustand |
| 数据 | PocketBase |
| 路由 | react-router-dom |
| 图表 / 图标 | Recharts、lucide-react |

## 当前路由

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

## 快速开始

### 1. 安装依赖

```powershell
npm install
```

### 2. 准备 PocketBase

把对应平台的 `pocketbase` / `pocketbase.exe` 放在 `backend/pocketbase/`。

先应用迁移：

```powershell
npm run pb:migrate
```

或在 `backend/pocketbase` 中执行：

```powershell
.\pocketbase.exe migrate up
```

迁移会创建业务集合、写入示例数据、开放本地开发 API 规则，并清理旧版废弃集合。

### 3. 启动 PocketBase

```powershell
npm run pb:serve
```

默认 Admin UI：`http://127.0.0.1:8090/_/`。

### 4. 配置前端环境变量

```powershell
Copy-Item .env.example .env
```

默认 `VITE_POCKETBASE_URL=http://127.0.0.1:8090`。

### 5. 启动前端

```powershell
npm run dev
```

### 6. 构建

```powershell
npm run build
npm run preview
```

## 目录结构

```text
src/
  app/           路由与布局
  pages/         页面
  components/    通用展示组件
  features/      领域功能模块
  store/         Zustand 状态
  services/      PocketBase 客户端
  models/        TypeScript 实体类型
backend/
  pocketbase/    PocketBase 迁移、集合说明和种子说明
Doc/
  goalops_prd.md 当前唯一 PRD
```

## 后端集合

详见 [backend/pocketbase/COLLECTIONS.md](backend/pocketbase/COLLECTIONS.md)。

当前业务集合：

```text
members
objectives
key_results
tasks
blockers
```

## License

Private / internal.
