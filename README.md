# CTG ExpoPi

Offline touchscreen convention appliance for Linux-capable single-board computers.

## Stack

- Frontend: vanilla TypeScript, HTML, and CSS built with Vite
- Backend: Go
- Content: portable JSON content packs
- Local data: SQLite
- Linux deployment: systemd
- Kiosk browser: Cog/WPE preferred; Chromium fallback

## Workspace

- `frontend/` — touchscreen user interface
- `backend/` — Go service and local API
- `content/` — editable content packs and media
- `deploy/` — Linux service and kiosk configuration
- `scripts/` — development, packaging, and deployment helpers
- `docs/` — architecture and operator notes

## First development run

```powershell
cd frontend
npm install
npm run dev
```

In a second terminal:

```powershell
cd backend
go run ./cmd/expopi
```

