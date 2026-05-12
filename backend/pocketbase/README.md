# PocketBase

本目录用于在开发机运行 PocketBase 可执行文件与本地数据。`pb_data/` 不提交到 git。

产品需求见 [Doc/goalops_prd.md](../../Doc/goalops_prd.md)。

## 迁移

从仓库根目录执行：

```powershell
npm run pb:migrate
```

或在本目录执行：

```powershell
.\pocketbase.exe migrate up
```

迁移负责创建集合、写入示例数据、设置本地开发 API 规则，并清理旧版废弃集合。

## 启动

```powershell
npm run pb:serve
```

默认 Admin UI：`http://127.0.0.1:8090/_/`。

## 前端联调

1. 可从仓库根目录复制 `.env.example` 为 `.env`。
2. 默认 `VITE_POCKETBASE_URL=http://127.0.0.1:8090`。
3. 确保迁移已执行，再启动 `npm run dev`。

集合字段见 [COLLECTIONS.md](./COLLECTIONS.md)。种子说明见 [seed/README.md](./seed/README.md)。
