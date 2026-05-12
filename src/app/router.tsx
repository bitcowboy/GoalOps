import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppLayout } from '@/app/layouts/AppLayout'
import { ObjectiveDetailPage } from '@/pages/ObjectiveDetailPage'
import { GoalFormPage } from '@/pages/GoalFormPage'
import { ObjectivesPage } from '@/pages/ObjectivesPage'
import { PeopleManagePage } from '@/pages/PeopleManagePage'
import { PeoplePage } from '@/pages/PeoplePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TaskDetailPage } from '@/pages/TaskDetailPage'
import { TaskFormPage } from '@/pages/TaskFormPage'
import { TasksPage } from '@/pages/TasksPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/objectives" replace /> },
      { path: 'objectives/new', element: <GoalFormPage /> },
      { path: 'objectives/:id/edit', element: <GoalFormPage /> },
      { path: 'objectives', element: <ObjectivesPage /> },
      { path: 'objectives/:id', element: <ObjectiveDetailPage /> },
      { path: 'tasks/new', element: <TaskFormPage /> },
      { path: 'tasks/:id/edit', element: <TaskFormPage /> },
      { path: 'tasks/:id', element: <TaskDetailPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'people/manage', element: <PeopleManagePage /> },
      { path: 'people', element: <PeoplePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
