# PocketBase（本地数据层）

本目录用于在开发机运行 **PocketBase** 可执行文件与本地数据（`pb_data/`，不上传到 git）。

## 前置条件

从 [PocketBase releases](https://github.com/pocketbase/pocketbase/releases) 下载与团队一致版本的二进制，放入本目录。Windows 下文件名为 `pocketbase.exe`。

## 迁移（首次必做）

集合、示例数据与开发用 API 规则由 `pb_migrations/` 下脚本维护。仓库根目录执行：

```powershell
npm run pb:migrate
```

或在本目录：

```powershell
.\pocketbase.exe migrate up
```

迁移在 `serve` 时也会自动尝试应用；手动执行可尽快发现脚本错误。**若迁移失败**，请根据终端报错调整脚本；不清空 `pb_data` 时请勿随意删除已应用的迁移文件名（会与 `_migrations` 表不一致）。

## 启动服务

```powershell
.\pocketbase.exe serve
```

默认 Admin：`http://127.0.0.1:8090/_/`（首次需创建 superuser）。

根目录可用 `npm run pb:serve`。

## 与前端联调

1. 复制仓库根目录的 `.env.example` 为 `.env`（可选），`VITE_POCKETBASE_URL` 指向 PocketBase `serve` 地址（默认 `http://127.0.0.1:8090`）。
2. 确保 `migrate up` 已成功（含开放规则迁移时，访客可调业务 API；**生产环境务必改为鉴权规则**）。
3. 启动前端：`npm run dev`。

集合字段说明见 [COLLECTIONS.md](./COLLECTIONS.md)；种子策略见 [seed/README.md](./seed/README.md)。

## 故障排除

### Admin 里 `objectives` / `tasks` 只有 `id` 列

多为首条迁移里字段未正确写入。仓库已提供修复迁移 `pb_migrations/1778075756_goalops_fix_obj_tasks_fields.js`。请先**停止** `pocketbase serve`，再执行：

```powershell
npm run pb:migrate
```

然后重启 `serve`，在 Admin → Collections → 对应集合 → **Fields** 中应能看到 `name`、`title`、`owner` 等字段。

### 列有了但单元格全是 N/A

多为**先有记录、后补字段**：旧行里业务列为空。已提供迁移 `pb_migrations/1778075974_goalops_rehydrate_seed_data.js`，会按 PRD 示例 **重新写入** `members` / `objectives` 的固定 id 记录（先停 `serve`，再执行 `npm run pb:migrate`）。

### 前端请求报错：`unknown field "objective"`（blockers / tasks 等）

多为集合里**未创建 `objective` → objectives 的关联字段**。仓库提供修复迁移 `pb_migrations/1778076400_goalops_fix_related_objective_relation.js`。请先**停止** `pocketbase serve`，在项目根目录执行 `npm run pb:migrate`，再重启 `serve`。

## 目录说明

| 路径 | 说明 |
|------|------|
| `pb_data/` | 本地数据库与上传文件（已 gitignore） |
| `pb_migrations/` | JS 迁移：集合结构、种子、`1=1` 开发规则等 |
| `seed/` | 种子说明（数据由迁移注入） |

产品需求见 [Doc/department_project_management_prd_v_0_1.md](../../Doc/department_project_management_prd_v_0_1.md)。
