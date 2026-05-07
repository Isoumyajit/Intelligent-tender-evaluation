# Intelligent Tender Evaluation (ITE)

An AI-powered full-stack platform for evaluating government tenders. Officers upload tender documents and bidder submissions, and the system uses LLM-based analysis to automatically extract eligibility criteria, evaluate each bidder against those criteria, and present results with document-level, page-level evidence attribution.

## Architecture

```
Intelligent-tender-evaluation/
├── ite-frontend/   # Angular 19 SPA (Angular Material, SCSS)
├── ite-backend/    # FastAPI backend (Python, PostgreSQL, Sarvam AI)
└── README.md
```

| Service      | Tech Stack                                  | Default URL            |
|-------------|---------------------------------------------|------------------------|
| **Frontend** | Angular 19, Angular Material, TypeScript    | http://localhost:4200  |
| **Backend**  | FastAPI, PostgreSQL 16, Sarvam AI (LLM)     | http://localhost:8000  |
| **Database** | PostgreSQL 16 (Docker)                      | localhost:5433         |

## Prerequisites

### All Platforms

| Tool       | Version     | Download                                      |
|-----------|-------------|-----------------------------------------------|
| Docker     | 20.10+      | https://docs.docker.com/get-docker/           |
| Python     | 3.11+       | https://www.python.org/downloads/             |
| Node.js    | 18.x+       | https://nodejs.org/                           |
| npm        | 9.x+        | Bundled with Node.js                          |
| Git        | 2.x+        | https://git-scm.com/downloads                |

### macOS

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install python@3.11 node docker
```

Make sure **Docker Desktop** is running before proceeding.

### Windows

1. Install [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
2. Install [Python 3.11+](https://www.python.org/downloads/) — check "Add Python to PATH" during installation
3. Install [Node.js 18+](https://nodejs.org/) — LTS version recommended
4. Enable WSL2 if prompted by Docker Desktop

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm docker.io docker-compose
sudo systemctl start docker
sudo usermod -aG docker $USER   # Log out and back in after this
```

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/your-org/Intelligent-tender-evaluation.git
cd Intelligent-tender-evaluation
```

### 2. Start the database

**macOS / Linux:**
```bash
bash ite-backend/scripts/setup-db.sh
```

**Windows (PowerShell):**
```powershell
.\ite-backend\scripts\setup-db.ps1
```

This creates a Docker container named `ite-postgres` running PostgreSQL 16 on **port 5433**.

### 3. Start the backend

```bash
cd ite-backend

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
# macOS / Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your API key
echo "SARVAM_API_KEY=your_sarvam_api_key_here" > .env
echo "DATABASE_URL=postgresql+asyncpg://ite_user:ite_password@localhost:5433/ite_db" >> .env

# Start the server
python -m uvicorn app.main:app --reload
```

Backend runs at **http://localhost:8000**. API docs at **http://localhost:8000/docs**.

### 4. Start the frontend

Open a **new terminal**:

```bash
cd ite-frontend

# Install dependencies
npm install

# Start dev server
npm start
```

Frontend runs at **http://localhost:4200**.

### 5. Open the application

Navigate to **http://localhost:4200** in your browser.

## Environment Variables

### Backend (`ite-backend/.env`)

| Variable            | Required | Default                                                                 | Description                           |
|--------------------|----------|-------------------------------------------------------------------------|---------------------------------------|
| `DATABASE_URL`      | No       | `postgresql+asyncpg://ite_user:ite_password@localhost:5432/ite_db`      | PostgreSQL connection string          |
| `SARVAM_API_KEY`    | Yes      | (empty)                                                                 | Sarvam AI API key for LLM calls       |
| `MOCK_BIDDER_DOCS`  | No       | `true`                                                                  | Use mock bidder documents             |
| `MOCK_TENDER_DOCS`  | No       | `true`                                                                  | Use mock tender documents             |

> **Note:** If using the `setup-db.sh` script, the database runs on port **5433**, so set `DATABASE_URL` accordingly.

### Frontend (`ite-frontend/src/environments/environment.ts`)

| Variable      | Default                  | Description              |
|--------------|--------------------------|--------------------------|
| `apiBaseUrl`  | `http://localhost:8000`  | Backend API base URL     |

## How It Works

1. **Upload Tender** — Officer uploads a tender document (PDF/DOCX)
2. **Add Bidders** — Officer uploads bidder submission documents
3. **Start Evaluation** — System extracts eligibility criteria from tender using LLM
4. **AI Evaluation** — Each bidder's documents are evaluated against extracted criteria using LLM with per-document, per-page evidence attribution
5. **Review Results** — Officer reviews pass/fail/review-required results with source evidence in an embedded document viewer
6. **Approve/Disqualify** — Officer makes final decisions; all actions are logged in an audit trail

## API Endpoints

| Method | Path                                                    | Description                      |
|--------|---------------------------------------------------------|----------------------------------|
| POST   | `/tenders/`                                             | Create tender with document      |
| GET    | `/tenders/`                                             | List all tenders                 |
| GET    | `/tenders/{id}`                                         | Get tender details               |
| POST   | `/tenders/{id}/bid/`                                    | Add bidder with documents        |
| GET    | `/tenders/{id}/bid/{bid_id}/evaluation`                 | Get bidder evaluation results    |
| PUT    | `/tenders/{id}/bid/{bid_id}/evaluation/{criterion}`     | Override a criterion             |
| PUT    | `/tenders/{id}/bid/{bid_id}/approval`                   | Approve/disqualify bidder        |
| POST   | `/process-tender/`                                      | Start tender evaluation job      |
| GET    | `/process-tender/{job_id}`                              | Get job status                   |
| GET    | `/audits/`                                              | Get audit logs                   |
| GET    | `/health`                                               | Health check                     |

Full interactive docs: **http://localhost:8000/docs**

## Database Reset

To reset the database to a clean state:

**macOS / Linux:**
```bash
bash ite-backend/scripts/setup-db.sh
```

**Windows:**
```powershell
.\ite-backend\scripts\setup-db.ps1
```

## Troubleshooting

| Issue                                | Solution                                                                 |
|--------------------------------------|--------------------------------------------------------------------------|
| `Address already in use` (port 8000) | `lsof -ti :8000 \| xargs kill -9` (macOS/Linux) or restart terminal     |
| `Connection refused` to database     | Ensure Docker is running and `ite-postgres` container is up              |
| `SARVAM_API_KEY is not configured`   | Add your API key to `ite-backend/.env`                                   |
| Frontend can't reach backend         | Ensure backend is running on port 8000; check CORS in `main.py`         |
| Docker permission denied             | Run `sudo usermod -aG docker $USER` and log out/in (Linux)              |
| `npm install` fails                  | Delete `node_modules` and `package-lock.json`, retry                     |

## Team

**Team Tricolor Techworks**

## License

All rights reserved.
