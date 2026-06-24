import React, { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Menu from './pages/Menu'
import VehicleRegistration from './pages/VehicleRegistration'
import { logoutApi, setLogoutCallback } from './utils/authApi'

// Protected Route component
function ProtectedRoute({ children }) {
  const isLoggedIn = localStorage.getItem('loggedIn') === 'true';
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('loggedIn') === 'true')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setLoggedIn(localStorage.getItem('loggedIn') === 'true')
  }, [location.pathname])

  // Đăng ký callback để authApi có thể force-logout khi refresh token hết hạn
  useEffect(() => {
    setLogoutCallback(() => {
      setLoggedIn(false)
      navigate('/', { replace: true })
    })
  }, [navigate])

  async function handleLogin() {
    localStorage.setItem('loggedIn', 'true')
    setLoggedIn(true)
  }

  async function handleLogout() {
    await logoutApi() // revoke refresh token trên server, xóa token local
    setLoggedIn(false)
    navigate('/', { replace: true })
  }

  const isDashboardRoute = location.pathname.startsWith('/my/')

  return (
    <>
      {!isDashboardRoute && (
        <header className="navbar">
          <nav>
            {loggedIn && (
              <button className="nav-button" onClick={handleLogout}>
                Đăng xuất
              </button>
            )}
          </nav>
        </header>
      )}
      <Routes>
        <Route path="/" element={<Login onLogin={handleLogin} />} />
        <Route path="/my/menu" element={
          <ProtectedRoute>
            <Menu />
          </ProtectedRoute>
        } />
        <Route path="/my/vehicle-registration" element={
          <ProtectedRoute>
            <VehicleRegistration />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  )
}
