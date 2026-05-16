/// <reference path="../pb_data/types.d.ts" />

/**
 * 从 objectives 集合移除 participant_ids 字段。
 *
 * 决策：GoalOps 走严格 OKR 信号 —— 单一 owner 问责 + 任务 assignee 表达「在做」。
 * 「参与者」作为一种次级身份引入了问责模糊，正式弃用并清字段。
 *
 * 幂等：字段已不存在则跳过。
 * down 恢复字段（不回填历史数据）。
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('objectives')
    const names = col.fields.fieldNames()
    if (names.includes('participant_ids')) {
      col.fields.removeByName('participant_ids')
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('objectives')
      const names = col.fields.fieldNames()
      if (!names.includes('participant_ids')) {
        col.fields.add(new JSONField({ name: 'participant_ids', maxSize: 200000 }))
        app.save(col)
      }
    } catch (_) {
      /* objectives 不存在 — 极端 down 路径 */
    }
  },
)
