Modern Login + Vehicle Management (React + Django)

Overview
- Frontend: React (Vite)
- Backend: Django + Django REST Framework (SQLite for dev)

Quick start (backend):

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Quick start (frontend):

```bash
cd frontend
npm install
npm run dev
```

Notes
- API base: `http://localhost:8000/api/`
- Login endpoint: `POST /api/login/` (send `username` and `password`)
- Register endpoint: `POST /api/register/` (send `username`, `password`)
- After successful login frontend redirects to `/my/vehicle-registration`
