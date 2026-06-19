import React, {useState} from 'react'
import {useNavigate, Link} from 'react-router-dom'

export default function Login({ onLogin }){
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e){
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.')
      return
    }

    setLoading(true)

    try {
      const payload = {
        login: username,
        password: password,
      }
      console.log('Login payload', payload)
      // Dùng Vite Proxy (tương đương Nginx trên Production) để bypass CORS mà vẫn giữ nguyên Custom Header
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Odoo-Database': import.meta.env.VITE_ODOO_DB, // Đọc từ file .env
        },
        body: JSON.stringify(payload),
      })

      let data = {}
      try {
        data = await res.json()
      } catch {
        data = { message: 'Invalid response' }
      }
      
      console.log('Login response', { status: res.status, data })
      setLoading(false)

      const isSuccess = res.ok && !data.error && (
        data.result?.RESULT === 'SUCCESS' || 
        data.result?.STATUS_CODE === '0000' ||
        data.uid || data.access_token || data.token || data.session_id || data.success || data.status === 'success'
      );

      if (isSuccess) {
        if (onLogin) {
          onLogin()
        }
        console.log('Login successful', data)
        // Log toàn bộ data.result để xác định field token
        console.log('Login result fields:', JSON.stringify(data.result))
        // Token nằm trong data.result.DATA.access_token
        const token =
          data.result?.DATA?.access_token ??
          data.result?.DATA?.ACCESS_TOKEN ??
          data.result?.ACCESS_TOKEN ??
          data.result?.access_token ??
          data.result?.TOKEN ??
          data.result?.token ??
          data.access_token ??
          data.token ??
          null
        console.log('Extracted token:', token)
        if (token) {
          localStorage.setItem('accessToken', token)
        }
        localStorage.setItem('loggedIn', 'true')
        navigate('/my/vehicle-registration', { replace: true })
      } else {
        const errorMsg = data.result?.MESSAGE || data.message || data.error?.data?.message || data.error?.message || data.error || 'Login failed. Please check your credentials.';
        setError(typeof errorMsg === 'string' ? errorMsg : 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      console.error('Login error', err)
      setLoading(false)
      setError('Unable to reach Odoo server. Please check your connection.')
    }
  }

  return (
    <main className="page-shell login-shell">
      <section className="card login-card">
        <div className="login-brand">
          <h1>Đăng nhập</h1>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="form-label">Tên tài khoản</label>
          <input className="form-input" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Nhập tên tài khoản" />

          <label className="form-label">Mật khẩu</label>
          <input className="form-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập mật khẩu" />

          {error && <div className="notice">{error}</div>}

          <button className="action-button" type="submit" disabled={loading} style={{marginTop: '18px'}}>
            {loading ? 'Signing in…' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  )
}
