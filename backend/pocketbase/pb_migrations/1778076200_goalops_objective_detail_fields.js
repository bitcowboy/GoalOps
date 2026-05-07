/// <reference path="../pb_data/types.d.ts" />

/**
 * 目标详情页字段：`display_code`、背景/价值、成功标准与范围外列表、阶段进展、行动建议。
 * 幂等：已存在字段则跳过。
 */
migrate(
  (app) => {
    const objectives = app.findCollectionByNameOrId('objectives')
    const names = objectives.fields.fieldNames()

    if (!names.includes('display_code')) {
      objectives.fields.add(new TextField({ name: 'display_code' }))
    }
    if (!names.includes('background')) {
      objectives.fields.add(new TextField({ name: 'background' }))
    }
    if (!names.includes('success_criteria')) {
      objectives.fields.add(
        new JSONField({
          name: 'success_criteria',
          maxSize: 200000,
        }),
      )
    }
    if (!names.includes('out_of_scope')) {
      objectives.fields.add(
        new JSONField({
          name: 'out_of_scope',
          maxSize: 200000,
        }),
      )
    }
    if (!names.includes('phase_timeline')) {
      objectives.fields.add(
        new JSONField({
          name: 'phase_timeline',
          maxSize: 200000,
        }),
      )
    }
    if (!names.includes('next_actions')) {
      objectives.fields.add(
        new JSONField({
          name: 'next_actions',
          maxSize: 200000,
        }),
      )
    }
    if (!names.includes('progress_delta_percent')) {
      objectives.fields.add(
        new NumberField({
          name: 'progress_delta_percent',
          min: -100,
          max: 100,
          onlyInt: false,
        }),
      )
    }

    app.save(objectives)
  },
  (app) => {
    void app
  },
)
