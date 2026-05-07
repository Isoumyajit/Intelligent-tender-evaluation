# ITE Frontend

Angular 19 single-page application for the Intelligent Tender Evaluation platform. Provides a modern UI for tender management, bidder evaluation review, document viewing, and audit trail inspection.

## Tech Stack

- **Angular** 19
- **Angular Material** 19
- **TypeScript** 5.7
- **SCSS** for styling
- **RxJS** 7.8

## Prerequisites

| Tool    | Version | Check Command        |
|---------|---------|----------------------|
| Node.js | 18.x+  | `node --version`     |
| npm     | 9.x+   | `npm --version`      |

### Install Node.js

**macOS:**
```bash
brew install node
```

**Windows:**
Download from https://nodejs.org/ (LTS version). The installer includes npm.

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## Setup

### 1. Install Dependencies

```bash
cd ite-frontend
npm install
```

### 2. Configure Environment

The API base URL is configured in `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
};
```

No changes needed if the backend runs on the default port 8000.

### 3. Start Development Server

```bash
npm start
```

The app runs at **http://localhost:4200** and auto-reloads on code changes.

> **Prerequisite:** The backend must be running on port 8000 before using the frontend.

## Available Scripts

| Command           | Description                              |
|-------------------|------------------------------------------|
| `npm start`       | Start dev server on port 4200            |
| `npm run build`   | Production build to `dist/ite-frontend/` |
| `npm run watch`   | Dev build with file watching             |
| `npm test`        | Run unit tests via Karma                 |

## Project Structure

```
ite-frontend/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── abstractions/       # Repository & renderer interfaces
│   │   │   ├── models/             # TypeScript interfaces & types
│   │   │   ├── services/           # HTTP repositories, state stores
│   │   │   ├── routing/            # Route definitions & helpers
│   │   │   ├── registry/           # Status descriptors & config
│   │   │   ├── evaluation/         # Scoring utilities
│   │   │   └── pipes/              # Custom Angular pipes
│   │   ├── pages/
│   │   │   ├── dashboard/          # Landing page with quick stats
│   │   │   ├── uploads/            # Tender upload + bidder form
│   │   │   ├── evaluations/        # Evaluation pipeline tracker
│   │   │   ├── tender-list/        # Processed tenders list
│   │   │   ├── bidder-list/        # Bidder cards + actions
│   │   │   ├── bidder-documents/   # Bidder document browser
│   │   │   ├── evaluation-report/  # Per-bidder evaluation report
│   │   │   └── audit-logs/         # Global audit log viewer
│   │   ├── shared/
│   │   │   ├── document-viewer/    # Embedded document viewer
│   │   │   ├── evidence-panel/     # Criterion evidence side panel
│   │   │   ├── header/             # App header with navigation
│   │   │   ├── footer/             # App footer
│   │   │   ├── breadcrumb/         # Breadcrumb navigation
│   │   │   ├── loading-panel/      # Loading state component
│   │   │   └── confirm-dialog/     # Confirmation dialog
│   │   ├── app.component.ts        # Root component
│   │   ├── app.config.ts           # DI providers & config
│   │   └── app.routes.ts           # Route table
│   ├── environments/
│   │   ├── environment.ts          # Dev config (apiBaseUrl)
│   │   └── environment.prod.ts     # Production config
│   ├── styles.scss                 # Global styles & theme
│   └── main.ts                     # Bootstrap entry point
├── public/                         # Static assets
├── angular.json                    # Angular CLI config
├── package.json                    # Dependencies & scripts
└── tsconfig.json                   # TypeScript config
```

## Key Features

- **Dashboard** with quick stats (waiting for bidders, being evaluated, ready for review)
- **Tender Upload** with drag-and-drop, inline bidder submission
- **Evaluation Pipeline** tracking with real-time progress
- **Evaluation Report** with category tabs, per-criterion status, collapsible tender requirements
- **Evidence Panel** with multi-document tabs, page navigation, and document viewer
- **Document Viewer** supporting PDF (per-page), DOCX, images, and plain text
- **Audit Trail** with timeline view and CSV export
- **Officer Actions**: approve/disqualify bidders, override individual criteria

## Production Build

```bash
npm run build
```

Output is in `dist/ite-frontend/browser/`. Serve with any static file server (Nginx, Vercel, etc.).

For production, update `src/environments/environment.prod.ts` with your backend URL:

```typescript
export const environment = {
  production: true,
  apiBaseUrl: 'https://your-api-domain.com',
};
```

## Common Issues

| Issue | Fix |
|-------|-----|
| `npm install` fails | Delete `node_modules/` and `package-lock.json`, retry |
| API calls fail | Ensure backend is running on port 8000 |
| Port 4200 in use | `npx kill-port 4200` or use `ng serve --port 4250` |
| SCSS compilation errors | Check Node.js version is 18+ |
| Blank page after build | Check browser console for CORS errors; verify backend CORS config |
