# Intelligent Tender Evaluation (ITE)

A full-stack application for intelligent evaluation of tenders, combining an Angular frontend with a Python/FastAPI backend.

## Repository Structure

```
Intelligent-tender-evaluation/
├── ite-frontend/   # Angular 19 SPA (Angular Material, SCSS)
├── ite-backend/    # FastAPI backend (Python, PostgreSQL, Sarvam AI)
└── README.md       # ← you are here
```

## Getting Started

Each part of the application has its own README with detailed setup and run instructions:

| Service | Tech Stack | README | Default URL |
|---------|-----------|--------|-------------|
| **Frontend** | Angular 19, Angular Material, TypeScript | [ite-frontend/README.md](./ite-frontend/README.md) | http://localhost:4200 |
| **Backend** | FastAPI, PostgreSQL, Sarvam AI | [ite-backend/README.md](./ite-backend/README.md) | http://localhost:8000 |

### Quick Start

1. **Start the backend first** — follow the [backend instructions](./ite-backend/README.md) to set up the database and run the API server on port 8000.
2. **Then start the frontend** — follow the [frontend instructions](./ite-frontend/README.md) to install dependencies and launch the dev server on port 4200.

The frontend dev server is pre-configured to proxy API requests to `http://localhost:8000`.
