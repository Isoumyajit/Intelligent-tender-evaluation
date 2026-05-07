# ITE Frontend

Intelligent Tender Evaluation frontend — an Angular 19 single-page application built with Angular Material and SCSS.

## Prerequisites

- **Node.js** >= 18.x (LTS recommended)
- **npm** >= 9.x (ships with Node)

> The Angular CLI is installed as a local dev dependency — no global install required.

## Getting Started

### 1. Install dependencies

```bash
cd ite-frontend
npm install
```

### 2. Configure the API base URL

The app reads its API base URL from TypeScript environment files in `src/environments/`.

| File | Default `apiBaseUrl` | Used when |
|------|---------------------|-----------|
| `environment.ts` | `http://localhost:8000` | Development (`ng serve`) |
| `environment.prod.ts` | *(empty)* | Production build (`ng build`) |

For local development the default points to `http://localhost:8000` — make sure the backend is running on that port (or update the URL to match your setup).

For production, set `apiBaseUrl` in `environment.prod.ts` to the deployed backend URL before building, or serve the frontend behind a reverse proxy that routes `/api` to the backend.

### 3. Start the development server

```bash
npm start
```

This runs `ng serve` under the hood. Open your browser at **http://localhost:4200/** — the app will live-reload on file changes.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the dev server on port 4200 |
| `npm run build` | Production build → `dist/ite-frontend/` |
| `npm run watch` | Incremental dev build (watches for changes) |
| `npm test` | Run unit tests with Karma + Jasmine |

## Production Build

```bash
npm run build
```

Build artifacts are written to `dist/ite-frontend/`. The browser-ready bundle is in `dist/ite-frontend/browser/` — serve this directory with any static file server.

## Deployment (Vercel)

A `vercel.json` is included with:

- Build command: `npm run build`
- Output directory: `dist/ite-frontend/browser`
- SPA fallback rewrite to `index.html`
- Cache and security headers

To deploy, connect the repo to Vercel or run:

```bash
npx vercel
```

## Project Structure

```
ite-frontend/
├── src/
│   ├── app/
│   │   ├── core/           # Services, models, HTTP interceptors, pipes
│   │   ├── pages/          # Feature route modules (dashboard, evaluations, uploads, etc.)
│   │   ├── shared/         # Reusable components (header, footer, dialogs, document viewer)
│   │   ├── app.component.* # Root component
│   │   ├── app.config.ts   # App configuration (providers)
│   │   └── app.routes.ts   # Route definitions
│   ├── environments/       # Environment-specific config (dev / prod)
│   ├── styles.scss          # Global styles
│   ├── index.html
│   └── main.ts             # Bootstrap entry point
├── angular.json            # Angular CLI workspace config
├── tsconfig.json           # TypeScript base config
├── vercel.json             # Vercel deployment config
└── package.json
```

## Running Tests

```bash
npm test
```

This launches Karma with Jasmine in a Chrome browser. Test files follow the `*.spec.ts` naming convention and live alongside the source files they test.

## Tech Stack

- **Angular** 19 (standalone components)
- **Angular Material** / CDK
- **RxJS** 7.8
- **TypeScript** 5.7
- **SCSS** for styling
- **Karma + Jasmine** for unit tests
