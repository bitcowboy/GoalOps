import { NavLink, Outlet } from 'react-router-dom'
import {
  ChevronDown,
  LayoutGrid,
  ListTodo,
  Settings,
  Target,
  Users,
} from 'lucide-react'

const navRow =
  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-[var(--goalops-text-muted)] hover:bg-[var(--goalops-sidebar-active)] hover:text-[var(--goalops-text)]'

const navActive =
  'bg-[var(--goalops-sidebar-active)] text-[var(--goalops-text)] font-semibold'

export function AppLayout() {
  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--goalops-bg)] text-[var(--goalops-text)]">
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-[var(--goalops-border)] bg-[var(--goalops-surface)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--goalops-border)] px-4 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <LayoutGrid className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">GoalOps</span>
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          <NavLink to="/objectives" className={({ isActive }) => `${navRow} ${isActive ? navActive : ''}`}>
            <Target className="size-[18px] shrink-0 opacity-80" />
            目标
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `${navRow} ${isActive ? navActive : ''}`}>
            <ListTodo className="size-[18px] shrink-0 opacity-80" />
            任务
          </NavLink>
          <NavLink to="/people" className={({ isActive }) => `${navRow} ${isActive ? navActive : ''}`}>
            <Users className="size-[18px] shrink-0 opacity-80" />
            团队
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `${navRow} ${isActive ? navActive : ''}`}>
            <Settings className="size-[18px] shrink-0 opacity-80" />
            设置
          </NavLink>
        </nav>
        <div className="border-t border-[var(--goalops-border)] p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 px-3 py-2.5 text-left text-sm font-medium text-[var(--goalops-text)] transition-colors hover:bg-slate-100"
          >
            <span className="min-w-0 truncate">AI 创新中心</span>
            <ChevronDown className="size-4 shrink-0 text-[var(--goalops-text-muted)]" aria-hidden />
          </button>
          <div className="mt-1 px-1 text-[11px] text-[var(--goalops-text-subtle)]">部门</div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
