# ITE Backend

FastAPI backend for the Intelligent Tender Evaluation platform. Handles tender/bidder management, LLM-based criteria extraction and evaluation, document storage, and audit logging.

## Tech Stack

- **Python** 3.11+
- **FastAPI** with async support
- **PostgreSQL** 16 (Docker or native)
- **SQLAlchemy** (async) + asyncpg
- **Sarvam AI** (LLM for criteria extraction and bidder evaluation)
- **PyMuPDF** (PDF text extraction)
- **python-docx** (DOCX text extraction)

## Prerequisites

| Tool       | Version | Check Command         |
|-----------|---------|------------------------|
| Python     | 3.11+   | `python3 --version`   |
| pip        | 22+     | `pip --version`       |
| PostgreSQL | 16      | Docker OR native      |

---

## Database Setup

You have three options: **Docker (recommended)**, **native macOS**, or **native Windows**. Pick one.

### Option A: Docker (Recommended — All Platforms)

This is the easiest method. Works on macOS, Windows, and Linux.

**1. Install Docker**

| Platform | Install |
|----------|---------|
| macOS    | [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/) |
| Windows  | [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) (enable WSL2 if prompted) |
| Linux    | `sudo apt install docker.io docker-compose` (Ubuntu/Debian) or [Docker Engine](https://docs.docker.com/engine/install/) |

Make sure Docker Desktop is **running** before proceeding.

**2. Run the setup script**

macOS / Linux:
```bash
cd ite-backend
bash scripts/setup-db.sh
```

Windows (PowerShell — run as Administrator if needed):
```powershell
cd ite-backend
.\scripts\setup-db.ps1
```

**What the script does:**
1. Removes any existing `ite-postgres` container
2. Builds a Docker image from `docker/Dockerfile` with `docker/init.sql` baked in
3. Starts the container on host port **5433**
4. Waits for PostgreSQL to be ready
5. Verifies connectivity with a test query

**3. Verify it worked**

```bash
# Check container is running
docker ps --filter name=ite-postgres

# Connect manually (optional)
docker exec -it ite-postgres psql -U ite_user -d ite_db -c "\dt"
```

You should see 12 tables listed.

**Connection details (Docker):**

| Field    | Value         |
|----------|---------------|
| Host     | `localhost`   |
| Port     | `5433`        |
| Database | `ite_db`      |
| User     | `ite_user`    |
| Password | `ite_password`|

**Connection string:**
```
postgresql+asyncpg://ite_user:ite_password@localhost:5433/ite_db
```

**Managing the Docker database:**

```bash
# Stop the database
docker stop ite-postgres

# Start it again (data persists)
docker start ite-postgres

# Reset everything (delete all data, recreate from scratch)
bash scripts/setup-db.sh          # macOS/Linux
.\scripts\setup-db.ps1            # Windows

# Force full rebuild (if init.sql changed)
docker rm -f ite-postgres
docker rmi ite-postgres-img
bash scripts/setup-db.sh
```

---

### Option B: Native PostgreSQL on macOS

**1. Install PostgreSQL via Homebrew**

```bash
brew install postgresql@16
```

**2. Start the service**

```bash
brew services start postgresql@16
```

**3. Create the database and user**

```bash
psql postgres -c "CREATE USER ite_user WITH PASSWORD 'ite_password';"
psql postgres -c "CREATE DATABASE ite_db OWNER ite_user;"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE ite_db TO ite_user;"
```

**4. Run the schema script**

```bash
psql -U ite_user -d ite_db -f docker/init.sql
```

**5. Verify**

```bash
psql -U ite_user -d ite_db -c "\dt"
```

**Connection string (native macOS — default port 5432):**
```
postgresql+asyncpg://ite_user:ite_password@localhost:5432/ite_db
```

**Managing native PostgreSQL on macOS:**

```bash
# Stop
brew services stop postgresql@16

# Start
brew services start postgresql@16

# Reset database
psql postgres -c "DROP DATABASE IF EXISTS ite_db;"
psql postgres -c "CREATE DATABASE ite_db OWNER ite_user;"
psql -U ite_user -d ite_db -f docker/init.sql
```

---

### Option C: Native PostgreSQL on Windows

**1. Download and install PostgreSQL**

Download from https://www.postgresql.org/download/windows/ (use the EDB installer).

During installation:
- Set the superuser password (remember it)
- Keep the default port **5432**
- Check "pgAdmin 4" if you want a GUI
- Add PostgreSQL `bin` directory to your PATH when prompted

**2. Open SQL Shell (psql) or pgAdmin**

Open **SQL Shell (psql)** from the Start menu, or use **pgAdmin 4**.

**3. Create the database and user**

In psql (connect as the superuser `postgres`):

```sql
CREATE USER ite_user WITH PASSWORD 'ite_password';
CREATE DATABASE ite_db OWNER ite_user;
GRANT ALL PRIVILEGES ON DATABASE ite_db TO ite_user;
\q
```

**4. Run the schema script**

Open Command Prompt or PowerShell:

```powershell
cd ite-backend
psql -U ite_user -d ite_db -f docker\init.sql
```

If `psql` is not in your PATH, use the full path:
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U ite_user -d ite_db -f docker\init.sql
```

**5. Verify**

```powershell
psql -U ite_user -d ite_db -c "\dt"
```

**Connection string (native Windows — default port 5432):**
```
postgresql+asyncpg://ite_user:ite_password@localhost:5432/ite_db
```

**Managing native PostgreSQL on Windows:**

```powershell
# Stop service
net stop postgresql-x64-16

# Start service
net start postgresql-x64-16

# Reset database (in psql as postgres superuser)
DROP DATABASE IF EXISTS ite_db;
CREATE DATABASE ite_db OWNER ite_user;
# Then re-run: psql -U ite_user -d ite_db -f docker\init.sql
```

---

### Option D: Native PostgreSQL on Linux (Ubuntu/Debian)

**1. Install PostgreSQL**

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
```

**2. Start the service**

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**3. Create the database and user**

```bash
sudo -u postgres psql -c "CREATE USER ite_user WITH PASSWORD 'ite_password';"
sudo -u postgres psql -c "CREATE DATABASE ite_db OWNER ite_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ite_db TO ite_user;"
```

**4. Run the schema script**

```bash
cd ite-backend
psql -U ite_user -h localhost -d ite_db -f docker/init.sql
```

**5. Verify**

```bash
psql -U ite_user -h localhost -d ite_db -c "\dt"
```

**Connection string (native Linux — default port 5432):**
```
postgresql+asyncpg://ite_user:ite_password@localhost:5432/ite_db
```

---

## Database Schema

The `docker/init.sql` creates these 12 tables:

| Table                          | Purpose                                   |
|-------------------------------|-------------------------------------------|
| `items`                        | Sample seed data                          |
| `attachments`                  | Uploaded file storage (binary)            |
| `tenders`                      | Tender records                            |
| `bids`                         | Bidder submissions per tender             |
| `bid_attachments`              | Links bids to uploaded documents          |
| `jobs`                         | Evaluation job tracking                   |
| `job_bidders`                  | Links jobs to bidders                     |
| `tender_criteria`              | LLM-extracted criteria groups             |
| `tender_evaluation_conditions` | Individual evaluation conditions          |
| `bidder_evaluations`           | Per-criterion evaluation verdicts         |
| `evaluation_overrides`         | Officer manual overrides                  |
| `audit_logs`                   | Full audit trail                          |

---

## Python Environment Setup

```bash
cd ite-backend

# Create virtual environment
python3 -m venv .venv

# Activate
# macOS / Linux:
source .venv/bin/activate
# Windows CMD:
.venv\Scripts\activate.bat
# Windows PowerShell:
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt
```

## Environment Variables

Create a `.env` file in the `ite-backend/` directory (or copy from `.env.example`):

```bash
cp .env.example .env
# Then edit .env with your values
```

```env
# Use port 5433 for Docker, 5432 for native PostgreSQL
DATABASE_URL=postgresql+asyncpg://ite_user:ite_password@localhost:5433/ite_db
SARVAM_API_KEY=your_sarvam_api_key_here
```

| Variable            | Required | Default                                                                 | Description                              |
|--------------------|----------|-------------------------------------------------------------------------|------------------------------------------|
| `DATABASE_URL`      | No       | `postgresql+asyncpg://ite_user:ite_password@localhost:5432/ite_db`      | AsyncPG connection string                |
| `SARVAM_API_KEY`    | Yes      | (empty)                                                                 | Sarvam AI API key for LLM               |
| `MOCK_BIDDER_DOCS`  | No       | `true`                                                                  | Load mock bidder documents               |
| `MOCK_TENDER_DOCS`  | No       | `true`                                                                  | Load mock tender text for criteria       |

> **Important:** Docker setup uses port **5433**. Native PostgreSQL uses port **5432**. Set your `DATABASE_URL` accordingly.

## Run the Server

```bash
python -m uvicorn app.main:app --reload
```

The server starts at **http://localhost:8000**.

- **API docs (Swagger):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/health

## Project Structure

```
ite-backend/
├── app/
│   ├── main.py                  # FastAPI app, middleware, lifespan
│   ├── config.py                # Pydantic settings (env vars)
│   ├── database.py              # SQLAlchemy async engine & session
│   ├── models.py                # ORM models (Tender, Bid, Job, etc.)
│   ├── schemas.py               # Pydantic request/response schemas
│   ├── tender_routes.py         # Tender CRUD endpoints
│   ├── bid_routes.py            # Bidder CRUD + evaluation endpoint
│   ├── process_tender_routes.py # Evaluation job processing
│   ├── audit_routes.py          # Audit log endpoints
│   └── services/
│       ├── llm_service.py              # Sarvam AI chat completion
│       ├── criteria_service.py         # LLM tender criteria extraction
│       ├── audit_service.py            # Audit logging
│       ├── ocr_service.py              # OCR orchestration
│       └── ocr_processor.py            # Sarvam OCR processor
├── docker/
│   ├── Dockerfile               # PostgreSQL image definition
│   └── init.sql                 # Database schema (12 tables)
├── mock/
│   ├── data/                    # Mock tender & bidder text files
│   └── pdf/                     # Mock bidder PDF documents
├── scripts/
│   ├── setup-db.sh              # DB setup (macOS/Linux)
│   ├── setup-db.ps1             # DB setup (Windows)
│   └── teardown-db.ps1          # DB teardown (Windows)
├── requirements.txt
├── .env.example                 # Environment variable template
└── ITE-API.postman_collection.json
```

## Using Mock / Demo Data

The `mock/` folder contains ready-to-use sample documents for testing the full evaluation flow without creating your own files.

### Mock Folder Structure

```
mock/
├── data/
│   ├── tender1/
│   │   └── tender1.txt                        # Sample tender document (Highway Construction)
│   ├── bidder1.txt                            # Bharat Engineering — strong bidder (all docs present)
│   ├── bidder2.txt                            # Delta Constructions — partial (GST pending, affidavit not notarized)
│   ├── bidder3.txt                            # Sunrise Infrastructure — weak (low balance, missing EMD)
│   └── bidder4.txt                            # Apex Builders — weakest (expired registration, no affidavit)
└── pdf/
    ├── Highway_Construction_Tender_2025-26.pdf  # Tender document PDF
    ├── Bharat_Engineering_Solutions/
    │   └── Bidder_Bharat_Engineering.pdf        # Bidder 1 submission PDF
    ├── Delta_Constructions/
    │   └── Bidder_Delta_Constructions.pdf       # Bidder 2 submission PDF
    ├── Sunrise_Infrastructure/
    │   └── Bidder_Sunrise_Infrastructure.pdf     # Bidder 3 submission PDF
    └── Apex_Builders/
        └── Bidder_Apex_Builders.pdf             # Bidder 4 submission PDF
```

### How to Use the Mock Data

**Step 1: Upload the tender**

Go to the Upload page (`http://localhost:4200/upload`) and upload:
- **Tender document:** `mock/pdf/Highway_Construction_Tender_2025-26.pdf`
- **Tender name:** `Highway Construction Tender 2025-26` (auto-filled from filename)

**Step 2: Add bidders**

Click "Go inside tender" then "Add bidder" for each:

| Bidder Name                     | Upload File                                                    | Expected Result   |
|--------------------------------|----------------------------------------------------------------|-------------------|
| Bharat_Engineering_Solutions   | `mock/pdf/Bharat_Engineering_Solutions/Bidder_Bharat_Engineering.pdf` | Mostly Passed     |
| Delta_Constructions            | `mock/pdf/Delta_Constructions/Bidder_Delta_Constructions.pdf`        | Mixed (partial)   |
| Sunrise_Infrastructure         | `mock/pdf/Sunrise_Infrastructure/Bidder_Sunrise_Infrastructure.pdf`   | Many Failed       |
| Apex_Builders                  | `mock/pdf/Apex_Builders/Bidder_Apex_Builders.pdf`                    | Mostly Failed     |

You can also upload the `.txt` files from `mock/data/` as plain-text bidder submissions — the system handles both PDF and text files.

**Step 3: Start evaluation**

Go to Evaluations page, find your tender, and click "Start evaluation". The system will:
1. Extract eligibility criteria from the tender using the LLM
2. For each bidder, evaluate their documents against those criteria
3. Show results with pass/fail/review status per criterion

### What the Mock Bidders Demonstrate

| Bidder | Scenario | Key Details |
|--------|----------|-------------|
| **Bharat Engineering** | Strong submission | All mandatory docs present, bank balance exceeds threshold, valid ISO cert, notarized affidavit |
| **Delta Constructions** | Partial compliance | GST clearance pending, affidavit NOT notarized, otherwise decent financials |
| **Sunrise Infrastructure** | Weak submission | Registration NOT renewed, bank balance BELOW threshold, no EMD, no tender fee |
| **Apex Builders** | Weakest submission | Registration expired, bank balance far below threshold, no GST clearance, no affidavit |

### Tender Criteria (extracted by LLM)

The mock tender document (`tender1.txt`) contains 9 eligibility requirements across these categories:

| # | Criterion | Category | Mandatory |
|---|-----------|----------|-----------|
| 1 | Registration Card Renewal | Legal/Eligibility | Yes |
| 2 | Bank Balance > Rs. 10,000,000 | Financial | Yes |
| 3 | GSTR-3B Clearance Certificate | Compliance | Yes |
| 4 | EMD (CDR/FDR) | Financial | Yes |
| 5 | Tender Fee (Treasury Challan) | Financial | Yes |
| 6 | Notarized Affidavit | Legal/Compliance | Yes |
| 7 | Valid PAN Card | Compliance | Yes |
| 8 | ISO 9001:2015 Certification | Certification | No |
| 9 | Previous Work Experience / References | Experience | No |

---

## API Testing

Import `ITE-API.postman_collection.json` into Postman for pre-configured API requests.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Address already in use` (port 8000) | `lsof -ti :8000 \| xargs kill -9` (macOS/Linux) |
| `Connection refused` to database | Start Docker Desktop / PostgreSQL service |
| `relation does not exist` | Force rebuild: `docker rm -f ite-postgres && docker rmi ite-postgres-img && bash scripts/setup-db.sh` |
| `SARVAM_API_KEY is not configured` | Create `.env` with your API key |
| `ModuleNotFoundError` | Activate venv: `source .venv/bin/activate` |
| Port 5432 vs 5433 mismatch | Docker uses 5433, native uses 5432 — match `DATABASE_URL` |
| `psql: command not found` (Windows) | Add `C:\Program Files\PostgreSQL\16\bin` to your PATH |
| Docker permission denied (Linux) | `sudo usermod -aG docker $USER` then log out/in |
