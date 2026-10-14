import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ApiError } from './api/client'
import { Layout } from './components/Layout'
import './index.css'
import { AppDetail } from './pages/AppDetail'
import { Apps } from './pages/Apps'
import { Login, Signup } from './pages/Auth'
import { Logs } from './pages/Logs'
import { NotFound } from './pages/NotFound'
import { Overview } from './pages/Overview'
import { Playground } from './pages/Playground'
import { Settings } from './pages/Settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Don't retry client errors (404, 400…); do retry network blips and 5xx.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
})

const router = createBrowserRouter([
  { path: 'login', element: <Login /> },
  { path: 'signup', element: <Signup /> },
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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <ReactQueryDevtools buttonPosition="bottom-right" />
    </QueryClientProvider>
  </StrictMode>,
)
