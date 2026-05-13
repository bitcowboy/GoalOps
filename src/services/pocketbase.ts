import PocketBase from 'pocketbase'

const url = import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090'

/**
 * 全局 PocketBase 客户端。
 * MVP 不启用登录：集合规则需在 Admin 中配置为可读/可写（或仅内网使用）。
 *
 * `autoCancellation(false)`：禁用 SDK 基于 URL 的自动取消。React StrictMode
 * 下 useEffect 双跑 / 同一页同一接口短时间内被并发触发时，默认行为会让先到
 * 的请求被取消并以 "autocancelled" 抛错，导致页面错把这个 abort 当成真实错误
 * 渲染红色错误条。本应用各页都已用 `cancelled` 旗标 + `silent` 静默刷新管自身
 * 的过期请求，不依赖 SDK 这层。如需对个别请求保留取消语义，请显式传
 * `requestKey: '<unique-key>'`。
 */
export const pb = new PocketBase(url)
pb.autoCancellation(false)

export function getPocketBaseUrl() {
  return url
}
