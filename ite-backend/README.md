# ITE API

A Python FastAPI application connected to PostgreSQL.

## Prerequisites

- **Docker Desktop** (running)
- **Python 3.11+**

## Quick Start

### 1. Start the database

```powershell
.\scripts\setup-db.ps1
```

This builds the Docker image, starts a PostgreSQL container, and verifies connectivity.

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the API

```bash
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

## API Endpoints

| Method   | Path            | Description       |
|----------|-----------------|-------------------|
| `GET`    | `/health`       | Health check      |
| `GET`    | `/items/`       | List all items    |
| `GET`    | `/items/{id}`   | Get item by ID    |
| `POST`   | `/items/`       | Create a new item |
| `PUT`    | `/items/{id}`   | Update an item    |
| `DELETE` | `/items/{id}`   | Delete an item    |

## Configuration

Set `DATABASE_URL` in `.env` or as an environment variable to override the default connection string.
