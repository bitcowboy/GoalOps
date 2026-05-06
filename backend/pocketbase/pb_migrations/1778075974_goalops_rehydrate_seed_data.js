/// <reference path="../pb_data/types.d.ts" />

/**
 * 在「先插种子、后补字段」或字段曾缺失的情况下，记录里业务列为空，Admin 会显示 N/A。
 * 本迁移按固定 id 重新写入 PRD §14 示例数据（存在则覆盖，不存在则创建）。
 */
migrate(
  (app) => {
    const membersCol = app.findCollectionByNameOrId('members')
    const objectivesCol = app.findCollectionByNameOrId('objectives')

    const memberDefs = [
      {
        id: 'mbr100000000001',
        name: '张雨薇',
        role: '算法工程师',
        team: 'AI 创作平台组',
        weeklyAvailableHours: 40,
      },
      {
        id: 'mbr200000000002',
        name: '王皓',
        role: 'AI 产品经理',
        team: '智能客服组',
        weeklyAvailableHours: 40,
      },
      {
        id: 'mbr300000000003',
        name: '陈子墨',
        role: '模型训练工程师',
        team: 'VLA 训练组',
        weeklyAvailableHours: 40,
      },
      {
        id: 'mbr400000000004',
        name: '刘凯',
        role: 'AI 工程师',
        team: 'RTS 原型组',
        weeklyAvailableHours: 40,
      },
    ]

    const saveMember = (m) => {
      let r
      try {
        r = app.findRecordById(membersCol, m.id)
      } catch (_) {
        r = new Record(membersCol)
        r.id = m.id
      }
      r.set('name', m.name)
      r.set('role', m.role)
      r.set('team', m.team)
      r.set('weekly_available_hours', m.weeklyAvailableHours)
      app.saveNoValidate(r)
    }

    for (const m of memberDefs) {
      saveMember(m)
    }

    const objectiveDefs = [
      {
        id: 'obj100000000001',
        name: 'AI 创作大赛小游戏开发平台',
        definition:
          '搭建面向创作者的 AI 驱动小游戏开发平台，降低创作门槛，激发生态活力。',
        progress_percent: 68,
        status: 'in_progress',
        priority: 'P0',
        owner: 'mbr100000000001',
        start_date: '2025-05-01',
        due_date: '2025-06-15',
      },
      {
        id: 'obj200000000002',
        name: '剑网3 智能客服',
        definition: '构建大模型驱动的智能客服体系，提升问题解决率与用户满意度。',
        progress_percent: 42,
        status: 'at_risk',
        priority: 'P1',
        owner: 'mbr200000000002',
        start_date: '2025-04-20',
        due_date: '2025-06-10',
      },
      {
        id: 'obj300000000003',
        name: 'VLA 模型训练',
        definition: '训练多模态 VLA 模型，提升游戏 AI 在复杂场景下的理解与决策能力。',
        progress_percent: 33,
        status: 'at_risk',
        priority: 'P0',
        owner: 'mbr300000000003',
        start_date: '2025-04-15',
        due_date: '2025-07-01',
      },
      {
        id: 'obj400000000004',
        name: 'RTS 项目原型验证',
        definition: '验证核心玩法与 AI 指挥官方案，打磨可玩性，为立项提供数据支撑。',
        progress_percent: 55,
        status: 'in_progress',
        priority: 'P1',
        owner: 'mbr400000000004',
        start_date: '2025-04-20',
        due_date: '2025-06-30',
      },
    ]

    const saveObjective = (o) => {
      let r
      try {
        r = app.findRecordById(objectivesCol, o.id)
      } catch (_) {
        r = new Record(objectivesCol)
        r.id = o.id
      }
      r.set('name', o.name)
      r.set('definition', o.definition)
      r.set('progress_percent', o.progress_percent)
      r.set('status', o.status)
      r.set('priority', o.priority)
      r.set('owner', o.owner)
      r.set('start_date', o.start_date)
      r.set('due_date', o.due_date)
      app.saveNoValidate(r)
    }

    for (const o of objectiveDefs) {
      saveObjective(o)
    }
  },
  (app) => {
    void app
  },
)
