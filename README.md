# PsikoRender

PsikoRender is a local-first, open source text-to-video MVP. It accepts text, a voice audio upload and a background video, generates `.ass` captions, queues a render job, runs FFmpeg in a Rust worker and exports an MP4 for social formats.

## Stack

- Frontend: Qwik City + TailwindCSS
- Backend: Rust, Axum, Tokio, Serde, SQLx
- Jobs: Redis queue
- Data: PostgreSQL
- Storage: local folders under `storage/`
- Render: FFmpeg CLI

## Requirements

- Rust stable
- Node.js 20+
- Docker Desktop
- FFmpeg and FFprobe available in `PATH`

## Run locally

```powershell
Copy-Item .env.example .env
docker compose up -d
cargo run -p api
```

In a second terminal:

```powershell
cargo run -p worker
```

In a third terminal:

```powershell
cd apps/web
npm install
npm run dev
```

Open `http://localhost:5173`.

## Deploy frontend to Vercel through GitHub

This repository includes `vercel.json` so Vercel can deploy the web app from the monorepo root.

1. Push the repository to GitHub.
2. In Vercel, import the GitHub repository.
3. Keep the project root as the repository root.
4. Vercel will use:
   - Install command: `cd apps/web && npm install`
   - Build command: `cd apps/web && npm run build`
   - Output directory: `apps/web/dist`
5. Set `PUBLIC_API_URL` in Vercel if the frontend should talk to a deployed API.

The current Vercel deploy is frontend-only. The Rust API, Redis worker, PostgreSQL and FFmpeg render pipeline need a separate container/VPS host or another backend runtime.

## MVP flow

1. Create a project from `/create`.
2. Upload a background video.
3. Upload voice audio.
4. Click generate.
5. The API creates a queued job and the worker renders with FFmpeg.
6. Open the project details page to track status and download the MP4.

## API

- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/backgrounds/upload`
- `POST /api/audio/upload`
- `POST /api/captions/generate`
- `POST /api/render`
- `GET /api/jobs/:id`
- `GET /api/videos/:id/download`

## Notes

The first MVP intentionally avoids paid or closed APIs. TTS connectors live behind a trait in `crates/tts`; XTTS-v2, F5-TTS, Piper, OpenVoice and optional RVC can be added without changing the API flow.
