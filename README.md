# CREDASYS — Intelligent Corporate Credit Decision Engine

> AI-powered credit risk analysis platform for hackathons and production use.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (optional — SQLite fallback available)

---

### 1. Clone & Setup

```bash
git clone <repo>
cd credasys
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy ..\\.env.example .env
# Edit .env with your API keys
```

#### Required `.env` values

| Variable              | Purpose                                                               |
| --------------------- | --------------------------------------------------------------------- |
| `GROQ_API_KEY`        | LLM for research & scoring ([get free key](https://console.groq.com)) |
| `DATABASE_URL`        | PostgreSQL connection string                                          |
| `FIREBASE_PROJECT_ID` | Firebase project (leave blank to skip auth in dev)                    |

#### Run backend

```bash
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

---

### 3. Frontend Setup

```bash
cd frontend
npm install

# Configure environment
copy ..\\.env.example .env.local
# Fill NEXT_PUBLIC_* values
```

#### Run frontend

```bash
npm run dev
```

App: http://localhost:3000

---

## Project Structure

```
credasys/
├── backend/
│   ├── main.py                    # FastAPI app + routes
│   ├── config.py                  # Settings via pydantic-settings
│   ├── requirements.txt
│   ├── db/
│   │   ├── database.py            # Async SQLAlchemy engine
│   │   └── models.py              # User, Company, Document, CompanyAnalysis
│   ├── services/
│   │   ├── document_ingestor.py   # PDF/CSV/Excel/TXT → ChromaDB
│   │   ├── research_agent.py      # DuckDuckGo + LLM research
│   │   ├── risk_scoring.py        # Five-Cs credit scorer
│   │   └── cam_generator.py       # PDF + DOCX CAM generator
│   └── ai/
│       ├── embeddings.py          # SentenceTransformers adapter
│       └── rag_pipeline.py        # RAG: ChromaDB + Groq LLM
│
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── page.tsx           # Landing page
│       │   ├── dashboard/         # Main dashboard
│       │   ├── upload/            # Document upload
│       │   ├── research/          # Research insights
│       │   ├── risk/              # Risk score visualization
│       │   └── report/            # CAM report download
│       ├── components/
│       │   ├── Navbar.tsx
│       │   └── Sidebar.tsx
│       ├── contexts/
│       │   └── AuthContext.tsx    # Firebase auth state
│       └── lib/
│           ├── firebase.ts        # Firebase SDK
│           └── api.ts             # Typed API client
│
└── deployment/
    ├── Dockerfile                 # Railway-compatible backend image
    ├── railway.toml
    └── vercel.json                # Vercel frontend config
```

---

## API Endpoints

| Method | Endpoint                   | Description                |
| ------ | -------------------------- | -------------------------- |
| `GET`  | `/health`                  | Health check               |
| `POST` | `/upload-documents`        | Upload financial documents |
| `POST` | `/analyze-company`         | Run full analysis pipeline |
| `POST` | `/generate-report`         | Generate CAM (PDF + DOCX)  |
| `GET`  | `/risk-score/{company_id}` | Get risk score             |
| `POST` | `/auth/verify-token`       | Verify Firebase token      |

---

## AI Pipeline

```
Documents → PyMuPDF/Unstructured → Text → Chunking
                                              ↓
                                    SentenceTransformers
                                              ↓
                                         ChromaDB
                                              ↓
                  Web Research (DuckDuckGo → Groq LLaMA 3)
                                              ↓
                           Five-Cs Risk Scoring Engine
                                              ↓
                              CAM (PDF + DOCX) via ReportLab
```

---

## Deployment

### Backend → Railway

1. **Push to GitHub**: Commit and push all changes including `Procfile` and `requirements.txt`.
2. **Create Project**: Log in to [Railway](https://railway.app) and select **New Project** → **Deploy from GitHub repo**.
3. **Configure Settings**:
   - Root Directory: Use root or `backend/` depending on your monorepo setup.
   - Environment Variables: Add `GROQ_API_KEY`, `DATABASE_URL`, and `FIREBASE_PROJECT_ID`.
4. **Deploy**: Railway uses the `Procfile` to run the server on a dynamic port.

### Frontend → Vercel

1. Connect Vercel to repo
2. Set root directory to `frontend/`
3. Add `NEXT_PUBLIC_BACKEND_URL` = your Railway URL
4. Add Firebase env vars
5. Deploy

---

## Tech Stack

| Layer     | Technology                                        |
| --------- | ------------------------------------------------- |
| Frontend  | Next.js 14, TailwindCSS, Recharts, React Dropzone |
| Backend   | Python, FastAPI, SQLAlchemy (async)               |
| AI/LLM    | LangChain, Groq (LLaMA 3), SentenceTransformers   |
| Vector DB | ChromaDB                                          |
| Database  | PostgreSQL                                        |
| Auth      | Firebase Google Auth                              |
| Reports   | ReportLab (PDF), python-docx (DOCX)               |
| Deploy    | Railway (backend) + Vercel (frontend)             |

---

## Features

- **Document Ingestion** — Upload PDFs, CSVs, Excel, TXT
- **Research Agent** — Automated company news, promoter, litigation research
- **Five-Cs Scoring** — Explainable Character / Capacity / Capital / Collateral / Conditions
- **CAM Generation** — Professional PDF + DOCX Credit Appraisal Memo
- **Firebase Auth** — Google Sign-In
- **Risk Visualization** — Gauge, bar, radar charts

---



