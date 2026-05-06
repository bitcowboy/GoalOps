# GoalOps / 部门项目管理（MVP 骨架）

围绕部门目标、交付件、任务、人员占用与会议杂事的管理闭环，详见产品文档 [**PRD v0.1**](Doc/department_project_management_prd_v_0_1.md)。

## 技术栈

| 层级 | 选型 |
|------|------|
| 前端 | React 19、Vite 8、TypeScript、Tailwind CSS v4、Zustand |
| 数据 | [PocketBase](https://pocketbase.io/)（本地或自建部署） |
| 路由 | react-router-dom |
| 图表 / 图标 | Recharts、Lucide（依赖已添加，业务中按需使用） |

## MVP 边界

- **无登录 / 无复杂权限**：当前仓库通过迁移脚本为业务集合配置了访客可读写的 API 规则（`1=1`，仅适合**内网开发**；上线前必须在 Admin 中改为鉴权规则）。
- 四个主路由与 PRD 对齐：`/`、`/objectives/:id`、`/tasks`、`/people`（另含可选 `/settings`）。
- 首页与目标详情已接入 PocketBase 的 **`objectives`** 集合（列表 + 单条 + `expand: owner`）。

## 快速开始

### 1. 安装依赖

```powershell
npm install
```

### 2. 放置 PocketBase 与执行迁移

将对应平台的 `pocketbase` / `pocketbase.exe` 放在 `backend/pocketbase/`。

**先应用迁移**（创建集合、PRD 示例数据、以及开发用开放 API 规则），再启动服务：

```powershell
npm run pb:migrate
```

或在 `backend/pocketbase` 下：

```powershell
.\pocketbase.exe migrate up
```

迁移说明与集合字段见 [backend/pocketbase/COLLECTIONS.md](backend/pocketbase/COLLECTIONS.md)；种子数据逻辑见 `pb_migrations/*_seed*.js`（记录 id 满足 PocketBase **15 位 `[a-z0-9]`** 约束）。

### 3. 启动 PocketBase

根目录脚本：

```powershell
npm run pb:serve
```

或：

```powershell
cd backend/pocketbase
.\pocketbase.exe serve
```

默认 Admin UI：`http://127.0.0.1:8090/_/`（首次需创建 superuser）。

### 4. 配置前端环境变量（可选）

```powershell
Copy-Item .env.example .env
```

默认 `VITE_POCKETBASE_URL=http://127.0.0.1:8090`。

### 5. 启动前端

```powershell
npm run dev
```

在浏览器打开应用：看板页应列出 4 条示例目标，并可进入详情。

### 6. 构建

```powershell
npm run build
npm run preview
```

## 目录结构（摘要）

```text
src/
  app/           路由与布局
  pages/         页面（看板、目标详情、任务、人员、设置）
  components/    通用展示组件（占位）
  features/      领域功能模块（占位）
  store/         Zustand 状态
  services/      PocketBase 客户端与后续数据访问封装
  models/        TypeScript 实体类型
  utils/         阻塞检测、占用率、风险规则等纯函数（占位）
  styles/        样式说明（全局入口为 index.css）
backend/
  pocketbase/    可执行文件、pb_data、pb_migrations、seed 说明
Doc/             PRD 与产品文档
```

## 推荐实现顺序

与 PRD **§17 推荐开发顺序** 一致：布局 → 数据模型 → mock/seed → Zustand → 各页面 → PocketBase 持久化 → 规则与 UI 打磨。

## License

Private / internal — 按团队策略填写。
