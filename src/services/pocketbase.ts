import PocketBase from 'pocketbase'

const url = import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090'

/**
 * 全局 PocketBase 客户端。
 * MVP 不启用登录：集合规则需在 Admin 中配置为可读/可写（或仅内网使用）。
 */
export const pb = new PocketBase(url)

export function getPocketBaseUrl() {
  return url
}
