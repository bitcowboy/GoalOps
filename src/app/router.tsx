import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/app/layouts/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { ObjectiveCreatePage } from '@/pages/ObjectiveCreatePage'
import { ObjectiveDetailPage } from '@/pages/ObjectiveDetailPage'
import { ObjectiveEditPage } from '@/pages/ObjectiveEditPage'
import { ObjectivesPage } from '@/pages/ObjectivesPage'
import { PeoplePage } from '@/pages/PeoplePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TasksPage } from '@/pages/TasksPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'objectives/new', element: <ObjectiveCreatePage /> },
      { path: 'objectives/:id/edit', element: <ObjectiveEditPage /> },
      { path: 'objectives', element: <ObjectivesPage /> },
      { path: 'objectives/:id', element: <ObjectiveDetailPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'people', element: <PeoplePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
