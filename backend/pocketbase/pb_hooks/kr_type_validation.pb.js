/// <reference path="../pb_data/types.d.ts" />

/**
 * key_results 写入前校验：
 * - kr_type 必填，且属于 metric / checkbox / milestone 之一
 * - 当 kr_type = "metric" 时，start_value / target_value / unit / direction 必填且非默认值
 *
 * 创建 vs 更新：
 * - 创建时：metric 类必须显式传四个字段
 * - 更新时：只在本次 patch 明确改了 kr_type 时才强校验四字段；只改 name/note 不强求
 *
 * "显式传"通过 e.requestInfo().body 检测，避开 number 字段服务端默认 0 / select 默认 ""
 * 与人工填 0 / 空选不可区分的问题。
 *
 * goja 提醒：不要用「工厂函数返回 arrow」（const f = (a) => (e) => ...）这种二级函数
 * 语法包装 hook 回调 — 实测会触发静默 500。所以 create / update 拆成两份独立内联。
 */

const krTypeCreateHandler = (e) => {
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
  if (!krType) throw new BadRequestError('kr_type is required (metric | checkbox | milestone)')
  if (krType !== 'metric' && krType !== 'checkbox' && krType !== 'milestone') {
    throw new BadRequestError('kr_type must be one of: metric, checkbox, milestone')
  }
  if (krType === 'metric') {
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
    const direction = record.get('direction')
    if (direction !== 'increase' && direction !== 'decrease') {
      throw new BadRequestError('direction must be increase or decrease')
    }
  }
  e.next()
}

const krTypeUpdateHandler = (e) => {
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
  if (!krType) throw new BadRequestError('kr_type cannot be cleared')
  if (krType !== 'metric' && krType !== 'checkbox' && krType !== 'milestone') {
    throw new BadRequestError('kr_type must be one of: metric, checkbox, milestone')
  }

  // 仅当本次 patch 改了 kr_type 才强校验 metric 四字段
  if (krType === 'metric' && sentKey('kr_type')) {
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
    const direction = record.get('direction')
    if (direction !== 'increase' && direction !== 'decrease') {
      throw new BadRequestError('direction must be increase or decrease')
    }
  }
  e.next()
}

onRecordCreateRequest(krTypeCreateHandler, 'key_results')
onRecordUpdateRequest(krTypeUpdateHandler, 'key_results')
