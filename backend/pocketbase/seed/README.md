# Seed 数据

示例 **成员** 与 **目标** 由迁移文件 `pb_migrations/1778063807_goalops_seed_prd_mock.js` 写入，内容与 PRD §14 一致；记录 `id` 采用 15 位小写字母与数字（符合 PocketBase 对 `id` 的约束），与 PRD 文档里的 `obj-ai-creation` 等字符串**不完全相同**，但业务字段一致。

清空并重灌时请使用 PocketBase Admin 删除记录，或使用 `pocketbase.exe migrate down`（按迁移依赖谨慎操作）。**不要**在仓库中提交 `pb_data/` 或真实敏感数据。
