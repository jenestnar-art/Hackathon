import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  readDemoUser,
  removeDemoUser,
  saveDemoUser,
  type DemoUser,
} from '@/features/auth/authStore'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { SecurityWorkbenchPage } from '@/pages/SecurityWorkbenchPage'
import { TrackPlaceholderPage } from '@/pages/TrackPlaceholderPage'
import '@/styles/app.css'

function AppRoutes() {
  const [user, setUser] = useState<DemoUser | null>(() => readDemoUser())

  const handleLogin = (name: string) => {
    setUser(saveDemoUser(name))
  }

  const handleLogout = () => {
    removeDemoUser()
    setUser(null)
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={handleLogin} />
          )
        }
      />
      <Route
        path="/"
        element={
          user ? (
            <HomePage user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      {/* 网络安全关卡：连接真实 Docker 攻击机与 PixelForge 靶机 */}
      <Route
        path="/tracks/security"
        element={
          user ? (
            <SecurityWorkbenchPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/tracks/:trackId"
        element={
          user ? (
            <TrackPlaceholderPage />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
