# Web Vehicle Office

Portal đăng ký xe nội bộ, tích hợp với hệ thống Odoo qua REST API.

## Tech stack

- **Frontend:** React 18 + Vite
- **Backend:** Odoo (REST API)
- **Auth:** JWT (access token + refresh token)

## Cài đặt & chạy

```bash
cd frontend
npm install
npm run dev
```

## Biến môi trường

Tạo file `frontend/.env`:

```env
VITE_ODOO_DB=ten_database_odoo
```
