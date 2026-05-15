/// <reference path="../pb_data/types.d.ts" />

/**
 * kr_checkins 写入前校验：
 * - checkin_date 不能晚于今天
 * - confidence 1..10 整数
 * - 度量字段三选一一致性：依据关联 KR 的 kr_type
 *   - metric    → 必须显式传 current_value
 *   - checkbox  → 必须显式传 is_completed
 *   - milestone → 必须显式传 progress_percent
 * - 未传 status_signal 时按 confidence 推断
 *
 * "显式传"通过 e.requestInfo().body 检测，避开 number/bool 字段服务端默认 0/false
 * 与人工填 0/false 不可区分的问题。
 *
 * 创建 vs 更新：
 * - 创建时（isCreate=true）强校验「必须显式传度量字段」 + 「不能跨类型混填」
 * - 更新时（isCreate=false）跳过「必须显式传」检查（用户可能只 PATCH 一个 confidence），
 *   但仍然强校验「不能跨类型混填」，防止把 metric KR 的 check-in 改成有 is_completed 等
 *
 * 注意：goja 引擎不会把同文件其它顶层函数透出到 routerAdd / onXxx 回调闭包里，
 * 因此把校验逻辑内联到 const 表达式工厂里。
 */

const makeCheckinHandler = (isCreate) => (e) => {
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

  // 1) checkin_date <= today
  const rawDate = record.get('checkin_date')
  if (!rawDate) {
    throw new BadRequestError('checkin_date is required')
  }
  const dateStr = String(rawDate).slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) {
    throw new BadRequestError('checkin_date cannot be later than today')
  }

  // 2) confidence range
  const conf = record.get('confidence')
  if (conf === null || conf === undefined || conf === '') {
    throw new BadRequestError('confidence is required')
  }
  const confNum = Number(conf)
  if (!isFinite(confNum) || confNum < 1 || confNum > 10) {
    throw new BadRequestError('confidence must be an integer in [1, 10]')
  }

  // 3) type-consistency against KR.kr_type
  const krId = record.get('key_result')
  if (!krId) {
    throw new BadRequestError('key_result is required')
  }
  let kr
  try {
    kr = e.app.findRecordById('key_results', krId)
  } catch (_) {
    throw new BadRequestError('related key_result not found')
  }
  const krType = kr.get('kr_type') || 'checkbox'

  const sentCurrent = sentKey('current_value')
  const sentPercent = sentKey('progress_percent')
  const sentCompleted = sentKey('is_completed')

  if (krType === 'metric') {
    if (isCreate && !sentCurrent) {
      throw new BadRequestError('metric KR requires current_value on its check-in')
    }
    if (sentPercent) {
      throw new BadRequestError('metric KR check-in must not set progress_percent')
    }
    if (sentCompleted) {
      throw new BadRequestError('metric KR check-in must not set is_completed')
    }
  } else if (krType === 'checkbox') {
    if (isCreate && !sentCompleted) {
      throw new BadRequestError('checkbox KR requires is_completed on its check-in')
    }
    if (sentCurrent) {
      throw new BadRequestError('checkbox KR check-in must not set current_value')
    }
    if (sentPercent) {
      throw new BadRequestError('checkbox KR check-in must not set progress_percent')
    }
  } else if (krType === 'milestone') {
    if (isCreate && !sentPercent) {
      throw new BadRequestError('milestone KR requires progress_percent on its check-in')
    }
    if (sentCurrent) {
      throw new BadRequestError('milestone KR check-in must not set current_value')
    }
  } else {
    throw new BadRequestError('unknown kr_type on related key_result: ' + krType)
  }

  // 4) status_signal 默认派生
  const status = record.get('status_signal')
  if (!status) {
    let derived
    if (confNum >= 7) derived = 'on_track'
    else if (confNum >= 4) derived = 'at_risk'
    else derived = 'off_track'
    record.set('status_signal', derived)
  }

  e.next()
}

onRecordCreateRequest(makeCheckinHandler(true), 'kr_checkins')
onRecordUpdateRequest(makeCheckinHandler(false), 'kr_checkins')
