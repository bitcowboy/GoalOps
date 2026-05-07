/// <reference path="../pb_data/types.d.ts" />

/**
 * 在 objective 详情字段迁移之后写入示例数据：
 * - 为关联集合补充详情表格常用字段（幂等）
 * - 填充四个示例目标的详情字段；为 RTS（obj400000000004）写入文档/交付件/任务/卡点示例
 */
migrate(
  (app) => {
    const membersCol = app.findCollectionByNameOrId('members')
    const objectivesCol = app.findCollectionByNameOrId('objectives')
    const tasksCol = app.findCollectionByNameOrId('tasks')
    const deliverablesCol = app.findCollectionByNameOrId('deliverables')
    const docsCol = app.findCollectionByNameOrId('core_documents')
    const blockersCol = app.findCollectionByNameOrId('blockers')

    const taskNames = tasksCol.fields.fieldNames()
    if (!taskNames.includes('due_date')) {
      tasksCol.fields.add(new DateField({ name: 'due_date' }))
    }
    app.save(tasksCol)

    const delNames = deliverablesCol.fields.fieldNames()
    if (!delNames.includes('version')) {
      deliverablesCol.fields.add(new TextField({ name: 'version' }))
    }
    if (!delNames.includes('planned_completion_date')) {
      deliverablesCol.fields.add(new DateField({ name: 'planned_completion_date' }))
    }
    app.save(deliverablesCol)

    const docNames = docsCol.fields.fieldNames()
    if (!docNames.includes('version')) {
      docsCol.fields.add(new TextField({ name: 'version' }))
    }
    if (!docNames.includes('doc_status')) {
      docsCol.fields.add(new TextField({ name: 'doc_status' }))
    }
    if (!docNames.includes('owner')) {
      docsCol.fields.add(
        new RelationField({
          name: 'owner',
          maxSelect: 1,
          collectionId: membersCol.id,
          cascadeDelete: false,
        }),
      )
    }
    app.save(docsCol)

    const blkNames = blockersCol.fields.fieldNames()
    if (!blkNames.includes('owner')) {
      blockersCol.fields.add(
        new RelationField({
          name: 'owner',
          maxSelect: 1,
          collectionId: membersCol.id,
          cascadeDelete: false,
        }),
      )
    }
    if (!blkNames.includes('target_resolution_date')) {
      blockersCol.fields.add(new DateField({ name: 'target_resolution_date' }))
    }
    app.save(blockersCol)

    /** @type {Record<string, unknown>} */
    const commonPhases = [
      {
        title: '需求定义',
        status: 'done',
        progress_percent: 100,
        date_range: '04.20 - 04.28',
      },
      {
        title: '设计与迭代',
        status: 'in_progress',
        progress_percent: 50,
        date_range: '04.29 - 05.30',
      },
      {
        title: '验证与收敛',
        status: 'not_started',
        progress_percent: 0,
        date_range: '06.01 - 06.20',
      },
      {
        title: '交付上线',
        status: 'not_started',
        progress_percent: 0,
        date_range: '06.21 - 06.30',
      },
    ]

    const objectivePatches = [
      {
        id: 'obj100000000001',
        display_code: 'OBJ-2025-021',
        definition:
          '搭建面向创作者的 AI 驱动小游戏开发平台，降低创作门槛，激发生态活力。',
        background:
          '支撑创作者大赛与内部原型迭代，形成可复用的创作工具链与分发通路。',
        success_criteria: [
          '核心编辑器链路打通并完成 Demo',
          '创作者 onboarding 流程可用',
          '性能指标达到既定阈值',
        ],
        out_of_scope: ['商业化结算', '全量多语言', '重度玩法关卡策划'],
        phase_timeline: commonPhases,
        next_actions: [
          {
            suggestion: '补齐编辑器导出流水线验收清单',
            type: '效率提升',
            priority: 'P2',
            suggester_name: '张雨薇',
            suggester_initials: 'ZY',
            suggester_color: '#2563eb',
            suggestion_date: '2025-05-16',
          },
        ],
      },
      {
        id: 'obj200000000002',
        display_code: 'OBJ-2025-022',
        definition: '构建大模型驱动的智能客服体系，提升问题解决率与用户满意度。',
        background:
          '客服高峰期压力大，需要借助大模型提升首轮解决率并缩短排队时长。',
        success_criteria: ['新版对话流程上线', '质检抽样机制落地', '关键场景 SLA 达标'],
        out_of_scope: ['全渠道机器人统一账号体系', '语音实时通话'],
        phase_timeline: commonPhases,
        next_actions: [
          {
            suggestion: '推进第三方 SDK 兼容性验证窗口',
            type: '风险缓解',
            priority: 'P1',
            suggester_name: '王皓',
            suggester_initials: 'WH',
            suggester_color: '#ea580c',
            suggestion_date: '2025-05-17',
          },
        ],
      },
      {
        id: 'obj300000000003',
        display_code: 'OBJ-2025-023',
        definition: '训练多模态 VLA 模型，提升游戏 AI 在复杂场景下的理解与决策能力。',
        background:
          '复杂战斗与交互场景需要更强的视觉-语言-动作联合推理能力以支撑下一代玩法试验。',
        success_criteria: ['数据管线改造完成', '对照实验一轮收敛', '评估指标基线建立'],
        out_of_scope: ['端侧实时推理优化', '海外合规审查'],
        phase_timeline: commonPhases,
        next_actions: [
          {
            suggestion: '确认 GPU 扩容审批链路与时间点',
            type: '风险缓解',
            priority: 'P0',
            suggester_name: '陈子墨',
            suggester_initials: 'CZ',
            suggester_color: '#7c3aed',
            suggestion_date: '2025-05-15',
          },
        ],
      },
      {
        id: 'obj400000000004',
        display_code: 'OBJ-2025-024',
        progress_delta_percent: 12,
        definition: '验证核心玩法与技术可行性，输出可演示的 Alpha 原型。',
        background:
          'RTS 方向需要快速验证核心玩法（资源、建造、小规模对抗）与 AI 指挥官方案的可行性；同时验证客户端性能与网络同步的基础假设，为立项评审提供可演示证据与用户反馈入口。',
        success_criteria: [
          '关键玩法闭环可在局域网稳定演示 ≥30 分钟',
          'AI 指挥官可在「简单经济 / 防守」剧本下完成基础决策链',
          '帧时间与同步延迟达到既定阈值（Demo 阶段口径）',
          '输出 Alpha 试玩包与一页纸立项材料',
        ],
        out_of_scope: [
          '高精度美术与特效量产',
          '商业化付费与活动运营',
          '多端适配（主机 / 移动端）',
          '大规模对战匹配与反作弊',
        ],
        phase_timeline: [
          {
            title: '需求定义',
            status: 'done',
            progress_percent: 100,
            date_range: '04.20 - 04.28',
          },
          {
            title: '原型开发',
            status: 'in_progress',
            progress_percent: 65,
            date_range: '04.29 - 05.20',
          },
          {
            title: '内部验证',
            status: 'not_started',
            progress_percent: 0,
            date_range: '05.21 - 06.10',
          },
          {
            title: '交付上线',
            status: 'not_started',
            progress_percent: 0,
            date_range: '06.11 - 06.30',
          },
        ],
        next_actions: [
          {
            suggestion: '补齐 RTS Demo 场景脚本与验收 checklist（含性能采样点）',
            type: '效率提升',
            priority: 'P1',
            suggester_name: '刘凯',
            suggester_initials: 'LK',
            suggester_color: '#059669',
            suggestion_date: '2025-05-18',
          },
          {
            suggestion: '预约策划 / QA 联合试玩窗口并固化反馈模板',
            type: '协作',
            priority: 'P2',
            suggester_name: '刘凯',
            suggester_initials: 'LK',
            suggester_color: '#059669',
            suggestion_date: '2025-05-17',
          },
          {
            suggestion: '梳理 AI 指挥官失败案例集并标注优先级',
            type: '风险缓解',
            priority: 'P1',
            suggester_name: '张雨薇',
            suggester_initials: 'ZY',
            suggester_color: '#2563eb',
            suggestion_date: '2025-05-16',
          },
        ],
      },
    ]

    const saveObjectivePatch = (p) => {
      const r = app.findRecordById(objectivesCol, p.id)
      r.set('definition', p.definition)
      r.set('display_code', p.display_code)
      r.set('background', p.background)
      r.set('success_criteria', p.success_criteria)
      r.set('out_of_scope', p.out_of_scope)
      r.set('phase_timeline', p.phase_timeline)
      r.set('next_actions', p.next_actions)
      if (typeof p.progress_delta_percent === 'number') {
        r.set('progress_delta_percent', p.progress_delta_percent)
      }
      app.saveNoValidate(r)
    }

    for (const p of objectivePatches) {
      saveObjectivePatch(p)
    }

    /** Liu Kai team label aligned with UI mock */
    try {
      const lk = app.findRecordById(membersCol, 'mbr400000000004')
      lk.set('team', '游戏组')
      app.saveNoValidate(lk)
    } catch (_) {
      /** ignore */
    }

    const rtsId = 'obj400000000004'

    const upsert = (col, id, setter) => {
      let r
      try {
        r = app.findRecordById(col, id)
      } catch (_) {
        r = new Record(col)
        r.id = id
      }
      setter(r)
      app.saveNoValidate(r)
    }

    upsert(docsCol, 'doc400000000001', (r) => {
      r.set('title', 'RTS — 玩法与验收口径说明')
      r.set('url', 'https://example.com/docs/rts-scope')
      r.set('objective', rtsId)
      r.set('version', 'v0.6')
      r.set('doc_status', '已确认')
      r.set('owner', 'mbr400000000004')
    })
    upsert(docsCol, 'doc400000000002', (r) => {
      r.set('title', '原型演示脚本（Alpha）')
      r.set('url', 'https://example.com/docs/rts-demo-script')
      r.set('objective', rtsId)
      r.set('version', 'v0.3')
      r.set('doc_status', '评审中')
      r.set('owner', 'mbr100000000001')
    })
    upsert(docsCol, 'doc400000000003', (r) => {
      r.set('title', '性能采样记录模板')
      r.set('url', 'https://example.com/docs/perf-template')
      r.set('objective', rtsId)
      r.set('version', 'draft')
      r.set('doc_status', '草稿')
      r.set('owner', 'mbr400000000004')
    })

    upsert(deliverablesCol, 'dlv400000000001', (r) => {
      r.set('title', 'Alpha 试玩包（Windows）')
      r.set('objective', rtsId)
      r.set('status', '进行中')
      r.set('version', 'Alpha-0.2')
      r.set('planned_completion_date', '2025-06-05')
    })
    upsert(deliverablesCol, 'dlv400000000002', (r) => {
      r.set('title', '一页纸立项材料')
      r.set('objective', rtsId)
      r.set('status', '未开始')
      r.set('version', '—')
      r.set('planned_completion_date', '2025-06-25')
    })
    upsert(deliverablesCol, 'dlv400000000003', (r) => {
      r.set('title', '内部验证结论纪要')
      r.set('objective', rtsId)
      r.set('status', '未开始')
      r.set('version', '—')
      r.set('planned_completion_date', '2025-06-12')
    })

    upsert(tasksCol, 'tsk400000000001', (r) => {
      r.set('title', '补齐 RTS Demo 关键交互与 HUD')
      r.set('objective', rtsId)
      r.set('assignee', 'mbr400000000004')
      r.set('status', 'in_progress')
      r.set('priority', 'P1')
      r.set('due_date', '2025-05-22')
    })
    upsert(tasksCol, 'tsk400000000002', (r) => {
      r.set('title', 'AI 指挥官：防守剧本决策链调试')
      r.set('objective', rtsId)
      r.set('assignee', 'mbr100000000001')
      r.set('status', 'review')
      r.set('priority', 'P1')
      r.set('due_date', '2025-05-28')
    })
    upsert(tasksCol, 'tsk400000000003', (r) => {
      r.set('title', '局域网同步压力采样（小规模对战）')
      r.set('objective', rtsId)
      r.set('assignee', 'mbr400000000004')
      r.set('status', 'pending')
      r.set('priority', 'P2')
      r.set('due_date', '2025-06-03')
    })
    upsert(tasksCol, 'tsk400000000004', (r) => {
      r.set('title', '试玩反馈表单汇总')
      r.set('objective', rtsId)
      r.set('assignee', 'mbr200000000002')
      r.set('status', 'pending')
      r.set('priority', 'P2')
      r.set('due_date', '2025-06-08')
    })

    upsert(blockersCol, 'blk400000000001', (r) => {
      r.set('description', '原型关卡脚本与验收 checklist 尚未对齐，影响内部试玩节奏')
      r.set('severity', 'high')
      r.set('objective', rtsId)
      r.set('owner', 'mbr400000000004')
      r.set('target_resolution_date', '2025-05-24')
    })
    upsert(blockersCol, 'blk400000000002', (r) => {
      r.set('description', '性能采样口径（帧时间统计窗口）待 QA 确认')
      r.set('severity', 'medium')
      r.set('objective', rtsId)
      r.set('owner', 'mbr200000000002')
      r.set('target_resolution_date', '2025-05-30')
    })
  },
  (app) => {
    void app
  },
)
