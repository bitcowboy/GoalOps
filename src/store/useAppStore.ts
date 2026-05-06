import { create } from 'zustand'

const defaultPbUrl = import.meta.env.VITE_POCKETBASE_URL ?? 'http://127.0.0.1:8090'

type AppState = {
  /** PocketBase 服务地址（展示与 client 共用数据源说明） */
  pocketBaseUrl: string
  setPocketBaseUrl: (url: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  pocketBaseUrl: defaultPbUrl,
  setPocketBaseUrl: (url) => set({ pocketBaseUrl: url }),
}))
