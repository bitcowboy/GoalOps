/// <reference path="../pb_data/types.d.ts" />

/**
 * 修复：部分本地库的 `blockers` collection 缺失 `description` 与 `severity` 字段，
 * 导致 MCP / API 写入这两个字段时被 PocketBase 静默忽略，前端"问题描述/影响"列空白。
 *
 * 现象：直接 PATCH `description=...` 也无效，且 GET 响应里完全无该字段；旧 seed
 * `blk400000000001/2` 同样无该字段。
 *
 * 本迁移幂等地补齐这两个字段，并把已知 5 条记录的 description/severity 回填。
 * description 设为非必填，避免对历史空记录构成校验失败。
 */
migrate(
  (app) => {
    const blk = app.findCollectionByNameOrId('blockers')
    const names = blk.fields.fieldNames()

    if (!names.includes('description')) {
      blk.fields.add(
        new TextField({
          name: 'description',
          max: 10000,
          required: false,
        }),
      )
    }
    if (!names.includes('severity')) {
      blk.fields.add(
        new SelectField({
          name: 'severity',
          maxSelect: 1,
          required: false,
          values: ['low', 'medium', 'high'],
        }),
      )
    }
    app.save(blk)

    /**
     * 回填已知记录。仅当目标字段当前为空时写入，避免覆盖人工修改。
     * @type {Array<{id: string, description: string, severity: string, objective?: string, owner?: string}>}
     */
    const backfill = [
      {
        id: 'blk400000000001',
        description: '原型关卡脚本与验收 checklist 尚未对齐，影响内部试玩节奏',
        severity: 'high',
        objective: 'obj400000000004',
        owner: 'mbr400000000004',
      },
      {
        id: 'blk400000000002',
        description: '性能采样口径（帧时间统计窗口）待 QA 确认',
        severity: 'medium',
        objective: 'obj400000000004',
        owner: 'mbr200000000002',
      },
      {
        id: 'qnu5d982s6erv7p',
        description:
          '云问系统是否支持 TOKEN/CID 注入以传递跳转上下文未确认。若不可行，玩家端跳转人工后体验降级为"重新开始对话"，影响二阶段验收。责任人：李翔威评估。',
        severity: 'high',
      },
      {
        id: 'cev9r1cqmt16uhy',
        description:
          '浏览器插件 attach 到云问坐席系统的技术可行性未确认。该方案决定第一阶段产品形态（插件 vs 兜底独立页面），影响客服上下文抓取效率与模型输出 vs 人工编辑差异的自动捕获。责任人：蔡淼、陈龙；5/15 前给排期。',
        severity: 'high',
      },
      {
        id: '3m48vtzo7arcasu',
        description:
          'BID 敏感词触发后的模型输出返回策略待联合确认。当前第一版决策为"不返回，视为模型出错"，但不同模块规则可能不同，需与 BID + 项目组联合会议确认细则。责任人：李翔威组织。',
        severity: 'medium',
      },
    ]

    for (const row of backfill) {
      try {
        const rec = app.findRecordById('blockers', row.id)
        if (!rec.get('description')) rec.set('description', row.description)
        if (!rec.get('severity')) rec.set('severity', row.severity)
        if (row.objective && !rec.get('objective')) rec.set('objective', row.objective)
        if (row.owner && !rec.get('owner')) rec.set('owner', row.owner)
        app.save(rec)
      } catch (_) {
        /* 记录不存在则跳过 */
      }
    }
  },
  (app) => {
    /* down: 不做破坏性回滚以免数据丢失 */
    void app
  },
)
