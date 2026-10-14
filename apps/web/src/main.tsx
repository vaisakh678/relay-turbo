import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { Layout } from './components/Layout'
import { StoreProvider } from './data/store'
import './index.css'
import { AppDetail } from './pages/AppDetail'
import { Apps } from './pages/Apps'
import { Logs } from './pages/Logs'
import { NotFound } from './pages/NotFound'
import { Overview } from './pages/Overview'
import { Playground } from './pages/Playground'
import { Settings } from './pages/Settings'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'apps', element: <Apps /> },
      { path: 'apps/:appId', element: <AppDetail /> },
      { path: 'playground', element: <Playground /> },
      { path: 'logs', element: <Logs /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  </StrictMode>,
)
