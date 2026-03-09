# CREDASYS Setup Guide (Windows)

This guide is beginner-friendly and copy-paste ready.
Follow in order to make all flows work:

- Upload Docs
- Research
- Risk Score
- CAM Report
- Settings

## 1. Prerequisites

Install first:

- Python 3.11+ (3.12/3.13/3.14 also work)
- Node.js 18+ (Node 20 recommended)
- npm (comes with Node)

Optional:

- Git

## 2. Open Project Folder

```powershell
cd c:\Users\HP\OneDrive\Desktop\hackathon\credasys
```

## 3. Backend Setup

### 3.1 Create virtual env (first time only)

```powershell
cd backend
python -m venv venv
```

### 3.2 Activate virtual env

```powershell
.\venv\Scripts\activate
```

### 3.3 Install backend dependencies

```powershell
pip install -r requirements.txt
```

### 3.4 Create backend `.env`

```powershell
copy .env.example .env
```

Open `backend\.env` and set these values:

```env
ENVIRONMENT=development
AUTH_ENABLED=false
DATABASE_URL=sqlite+aiosqlite:///./credasys.db
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
SERPAPI_API_KEY=
ALLOWED_ORIGINS=["http://localhost:3000","http://127.0.0.1:3000","http://localhost:3001","http://127.0.0.1:3001"]
```

Notes:

- `GROQ_MODEL=llama-3.3-70b-versatile` is important (older models are decommissioned).
- `SERPAPI_API_KEY` can stay empty because DuckDuckGo fallback exists.
- `DATABASE_URL` with SQLite is easiest for local setup.

### 3.5 Run backend

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Keep this terminal open.

Check backend:

- Health: http://127.0.0.1:8000/health
- Swagger: http://127.0.0.1:8000/docs

## 4. Frontend Setup

Open a second terminal:

```powershell
cd c:\Users\HP\OneDrive\Desktop\hackathon\credasys\frontend
npm install
```

Create `frontend\.env.local`:

```powershell
@"
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000
"@ | Set-Content .env.local
```

Run frontend:

```powershell
npm run dev
```

Open app:

- http://localhost:3000
- If 3000 is busy, Next.js will run on http://localhost:3001

## 5. Daily Start (after first setup)

Terminal 1 (backend):

```powershell
cd c:\Users\HP\OneDrive\Desktop\hackathon\credasys\backend
.\venv\Scripts\activate
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 (frontend):

```powershell
cd c:\Users\HP\OneDrive\Desktop\hackathon\credasys\frontend
npm run dev
```

## 6. End-to-End Test Steps

1. Open backend docs: `http://127.0.0.1:8000/docs`
2. Verify APIs exist:
   - `POST /api/upload`
   - `POST /api/process`
   - `POST /api/research`
   - `POST /api/analyze`
   - `GET /api/cam/{company_id}`
3. In frontend, go to Upload Docs and upload one PDF.
4. Click `Upload & Ingest`.
5. Go to Research and click `Run Research`.
6. Open Risk Score page.
7. Open CAM Report page and generate report.
8. Open Settings and confirm backend URL is `http://127.0.0.1:8000`.

## 7. Fixes for Common Errors

### A) `Request failed: Network Error`

Cause: frontend cannot reach backend.

Fix:

1. Ensure backend is running on `127.0.0.1:8000`.
2. Ensure frontend `.env.local` has:
   `NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:8000`
3. Restart frontend after env changes.

### B) Groq decommissioned model errors

If you see errors like:

- `llama3-70b-8192 has been decommissioned`
- `llama-3.1-70b-versatile has been decommissioned`

Fix in `backend\.env`:

```env
GROQ_MODEL=llama-3.3-70b-versatile
```

Then restart backend.

### C) `EPERM` / `.next` errors in OneDrive

Fix:

```powershell
cd c:\Users\HP\OneDrive\Desktop\hackathon\credasys\frontend
Remove-Item -Recurse -Force .next
npm run dev
```

If still unstable, move repo out of OneDrive (recommended):

- `C:\dev\credasys`

### D) Upload/process fails with DB UUID errors

If you see `badly formed hexadecimal UUID string`, reset local DB once:

```powershell
cd c:\Users\HP\OneDrive\Desktop\hackathon\credasys\backend
if (Test-Path .\credasys.db) { Remove-Item .\credasys.db -Force }
```

Restart backend after deletion.

### E) `paddlepaddle` install error

Current `backend/requirements.txt` does not require `paddleocr`.
If pip still shows old cached behavior, upgrade pip and reinstall:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt --no-cache-dir
```

## 8. What Is Required vs Optional

Required to run complete local flow:

- `GROQ_API_KEY`
- Backend + Frontend both running
- Correct `NEXT_PUBLIC_BACKEND_URL`

Optional:

- `SERPAPI_API_KEY` (research still runs with DDG fallback)
- Firebase auth (local test can use `AUTH_ENABLED=false`)

## 9. Quick Success Criteria

You are fully set up when:

- Upload succeeds without network error.
- Ingestion completes.
- Research returns insights (not empty error toast).
- Risk Score page loads data.
- CAM Report endpoint returns report.


