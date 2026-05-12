import { NavLink, Outlet } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  LayoutGrid,
  ListTodo,
  Search,
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
    <div className="flex min-h-dvh bg-[var(--goalops-bg)] text-[var(--goalops-text)]">
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-[var(--goalops-border)] bg-[var(--goalops-surface)]">
        <div className="flex items-center gap-2.5 border-b border-[var(--goalops-border)] px-4 py-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <LayoutGrid className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">GoalOps</span>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--goalops-border)] bg-[var(--goalops-surface)]/95 px-6 py-3 backdrop-blur-sm">
          <div className="mx-auto flex max-w-[1400px] items-center gap-4">
            <button
              type="button"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--goalops-border)] bg-[var(--goalops-surface)] px-3 py-2 text-sm font-medium text-[var(--goalops-text)] shadow-sm hover:bg-slate-50"
            >
              AI 创新中心
              <ChevronDown className="size-4 text-[var(--goalops-text-muted)]" aria-hidden />
            </button>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--goalops-text-subtle)]"
                aria-hidden
              />
              <input
                type="search"
                placeholder="搜索目标、任务或成员"
                className="w-full rounded-xl border border-[var(--goalops-border)] bg-slate-50/80 py-2.5 pl-10 pr-4 text-sm text-[var(--goalops-text)] outline-none ring-[var(--goalops-primary)] placeholder:text-[var(--goalops-text-subtle)] focus:bg-[var(--goalops-surface)] focus:ring-2"
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="relative flex size-10 items-center justify-center rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] text-[var(--goalops-text-muted)] shadow-sm hover:bg-slate-50 hover:text-[var(--goalops-text)]"
                aria-label="通知"
              >
                <Bell className="size-[18px]" />
                <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-[var(--goalops-danger)] text-[10px] font-semibold text-white">
                  3
                </span>
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl border border-[var(--goalops-border)] bg-[var(--goalops-surface)] py-1 pl-1 pr-2 shadow-sm hover:bg-slate-50"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-600 text-sm font-semibold text-white">
                  L
                </span>
                <ChevronDown className="size-4 text-[var(--goalops-text-muted)]" aria-hidden />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto px-6 py-6">
          <div className="mx-auto max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
