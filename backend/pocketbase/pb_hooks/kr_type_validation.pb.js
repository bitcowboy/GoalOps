/// <reference path="../pb_data/types.d.ts" />

/**
 * key_results 写入前校验：
 * - kr_type 必填，且属于 metric / checkbox / milestone 之一
 * - 当 kr_type = "metric" 时，start_value / target_value / unit / direction 必填且非默认值
 *
 * 创建 vs 更新：
 * - 创建时（isCreate=true）：metric 类必须显式传四个字段
 * - 更新时（isCreate=false）：只在 user 当次改了 kr_type 到 metric 时才强校验四字段；
 *   若 kr_type 已是 metric 且本次 patch 只改 name/note/owner 等，不要求重发 metric 字段
 *
 * "显式传"通过 e.requestInfo().body 检测，避开 number 字段服务端默认 0 / select 默认 ""
 * 与人工填 0 / 空选不可区分的问题。
 *
 * 注意：goja 不会把同文件其它顶层函数透出到 routerAdd / onXxx 回调闭包里，因此把校验
 * 内联到 const 工厂里。
 */

const makeKRTypeHandler = (isCreate) => (e) => {
  const record = e.record
  if (!record) {
    e.next()
    return
  }

  let body = {}
  try {
    const info = e.requestInfo()
    if (info && info.body) body = info.body
  } catch (_) {
    body = {}
  }
  const sentKey = function (k) {
    return Object.prototype.hasOwnProperty.call(body, k)
  }

  const krType = record.get('kr_type')
  if (!krType) {
    throw new BadRequestError('kr_type is required (metric | checkbox | milestone)')
  }
  if (krType !== 'metric' && krType !== 'checkbox' && krType !== 'milestone') {
    throw new BadRequestError('kr_type must be one of: metric, checkbox, milestone')
  }
  if (krType === 'metric') {
    // 必填 metric 四字段在两种情况下要校验：
    // (a) 创建
    // (b) 更新 + 本次明确改了 kr_type（包括从其它类型切到 metric，或重申 metric）
    const krTypeChanged = sentKey('kr_type')
    const requireSent = isCreate || krTypeChanged
    if (requireSent) {
      const required = ['start_value', 'target_value', 'unit', 'direction']
      for (let i = 0; i < required.length; i++) {
        const field = required[i]
        const sent = sentKey(field)
        const stored = record.get(field)
        const hasMeaningfulStored =
          field === 'unit' || field === 'direction'
            ? stored !== null && stored !== undefined && stored !== ''
            : sent
        if (!hasMeaningfulStored) {
          throw new BadRequestError('metric KR requires ' + field)
        }
      }
    }
    const direction = record.get('direction')
    if (direction !== 'increase' && direction !== 'decrease') {
      throw new BadRequestError('direction must be increase or decrease')
    }
  }
  e.next()
}

onRecordCreateRequest(makeKRTypeHandler(true), 'key_results')
onRecordUpdateRequest(makeKRTypeHandler(false), 'key_results')
