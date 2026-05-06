import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Settings, Users, ListTodo } from 'lucide-react'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

export function AppLayout() {
  return (
    <div className="flex min-h-dvh bg-slate-50 text-slate-900">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            GoalOps
          </div>
          <div className="text-lg font-semibold">部门项目管理</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavLink to="/" end className={navClass}>
            <LayoutDashboard className="size-4 shrink-0" />
            概览
          </NavLink>
          <NavLink to="/tasks" className={navClass}>
            <ListTodo className="size-4 shrink-0" />
            任务
          </NavLink>
          <NavLink to="/people" className={navClass}>
            <Users className="size-4 shrink-0" />
            团队
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            <Settings className="size-4 shrink-0" />
            设置
          </NavLink>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-slate-500">
              搜索目标、任务、文档或成员（占位）
            </div>
            <div className="text-sm text-slate-400">通知 · 用户（MVP 占位）</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
