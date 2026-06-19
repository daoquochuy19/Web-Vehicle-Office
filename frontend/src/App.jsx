import React, { useEffect, useState } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import VehicleRegistration from './pages/VehicleRegistration'

export default function App(){
  const [loggedIn, setLoggedIn] = useState(() => localStorage.getItem('loggedIn') === 'true')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    setLoggedIn(localStorage.getItem('loggedIn') === 'true')
  }, [location.pathname])

  function handleLogin() {
    localStorage.setItem('loggedIn', 'true')
    setLoggedIn(true)
  }

  function handleLogout() {
    localStorage.removeItem('loggedIn')
    setLoggedIn(false)
    navigate('/')
  }

  return (
    <>
      <header className="navbar">
        <nav>
          {loggedIn && (
            <button className="nav-button" onClick={handleLogout}>
              Đăng xuất
            </button>
          )}
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Login onLogin={handleLogin}/>} />
        <Route path="/my/vehicle-registration" element={<VehicleRegistration/>} />
      </Routes>
    </>
  )
}
