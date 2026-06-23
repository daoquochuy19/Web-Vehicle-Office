/**
 * tokenManager.js
 * Quản lý access token và refresh token trong localStorage.
 * Decode JWT để lấy thời gian hết hạn mà không cần thư viện ngoài.
 */

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'
const LOGGED_IN_KEY = 'loggedIn'

// ─── Lưu ────────────────────────────────────────────────────────────────────

export function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(LOGGED_IN_KEY, 'true')
}

// ─── Đọc ────────────────────────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

// ─── Xóa ────────────────────────────────────────────────────────────────────

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(LOGGED_IN_KEY)
}

// ─── Decode JWT (không verify signature — chỉ đọc payload) ──────────────────

function decodeJwtPayload(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

/**
 * Kiểm tra access token có còn hạn không (với buffer 30 giây).
 * Trả về true nếu token còn hạn, false nếu đã hết hoặc không hợp lệ.
 */
export function isAccessTokenValid() {
  const token = getAccessToken()
  if (!token) return false
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 > Date.now() + 30_000
}

/**
 * Kiểm tra refresh token có còn hạn không.
 */
export function isRefreshTokenValid() {
  const token = getRefreshToken()
  if (!token) return false
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return false
  return payload.exp * 1000 > Date.now()
}
