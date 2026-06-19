/**
 * authApi.js
 * Wrapper cho fetch() với cơ chế tự động refresh access token.
 *
 * Flow:
 *  1. Đính kèm Authorization header vào mọi request.
 *  2. Nếu nhận 401 → thử gọi /api/v1/auth/refresh một lần.
 *  3. Refresh thành công → lưu access token mới → retry request gốc.
 *  4. Refresh thất bại → gọi forceLogout() → redirect về /.
 *
 * Tất cả API call trong app nên dùng authFetch thay vì fetch trực tiếp.
 */

import {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
  isRefreshTokenValid,
} from './tokenManager'

// Callback để trigger logout từ bên ngoài (được set bởi App.jsx)
let _logoutCallback = null

export function setLogoutCallback(fn) {
  _logoutCallback = fn
}

function forceLogout() {
  clearTokens()
  if (_logoutCallback) {
    _logoutCallback()
  } else {
    // Fallback nếu callback chưa được set
    window.location.href = '/'
  }
}

// ─── Refresh access token ────────────────────────────────────────────────────

let _refreshPromise = null // Dedup: tránh gọi refresh nhiều lần đồng thời

async function refreshAccessToken() {
  // Nếu đang có request refresh đang chạy, chờ nó xong
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken || !isRefreshTokenValid()) {
      throw new Error('No valid refresh token')
    }

    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Odoo-Database': import.meta.env.VITE_ODOO_DB,
        'Authorization': `Bearer ${refreshToken}`,
      },
      credentials: 'include',
    })

    const data = await res.json()
    if (!res.ok) throw new Error(`Refresh failed: ${res.status}`)

    const newAccessToken =
      data.result?.DATA?.access_token ??
      data.result?.DATA?.ACCESS_TOKEN ??
      data.result?.access_token ??
      data.access_token ??
      null

    if (!newAccessToken) throw new Error('No access token in refresh response')

    saveTokens({ accessToken: newAccessToken })
    return newAccessToken
  })()
    .finally(() => {
      _refreshPromise = null
    })

  return _refreshPromise
}

// ─── authFetch ───────────────────────────────────────────────────────────────

/**
 * Thay thế fetch() — tự động đính kèm Bearer token và xử lý refresh.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
  const accessToken = getAccessToken()

  const headers = {
    'Accept': 'application/json',
    'X-Odoo-Database': import.meta.env.VITE_ODOO_DB,
    ...(options.headers || {}),
    ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
  }

  const res = await fetch(url, { ...options, headers, credentials: 'include' })

  // Token hợp lệ → trả về ngay
  if (res.status !== 401) return res

  // ── 401: thử refresh ──
  try {
    const newAccessToken = await refreshAccessToken()
    // Retry với token mới
    const retryHeaders = {
      ...headers,
      'Authorization': `Bearer ${newAccessToken}`,
    }
    return fetch(url, { ...options, headers: retryHeaders, credentials: 'include' })
  } catch {
    // Refresh thất bại → force logout
    forceLogout()
    // Trả về response 401 gốc để caller xử lý nếu cần
    return res
  }
}

// ─── Logout ──────────────────────────────────────────────────────────────────

/**
 * Gọi API logout (revoke refresh token trên server) rồi xóa token local.
 */
export async function logoutApi() {
  const refreshToken = getRefreshToken()
  const accessToken = getAccessToken()

  if (refreshToken) {
    try {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Odoo-Database': import.meta.env.VITE_ODOO_DB,
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch (err) {
      // Không block logout nếu network lỗi
      console.warn('Logout API call failed (non-blocking):', err)
    }
  }

  clearTokens()
}
