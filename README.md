# PsikoRender

PsikoRender is a local-first video MVP for turning text, uploaded voice audio and uploaded background video into short captioned videos.

The current deployed MVP runs in the browser and is suitable for Vercel: no file is uploaded to a backend, the render happens with Canvas, MediaRecorder and local browser media APIs, and the result is downloaded as a browser-supported video file, usually WebM.

Production URL: https://render-five-snowy.vercel.app

## What Works Now

- Landing page with a direct create flow.
- `/create` video builder with title, script, format, template, caption style, audio upload and background video upload.
- Local browser render with:
  - uploaded voice audio;
  - uploaded video background;
  - generated phrase captions;
  - vertical, square and landscape formats;
  - downloadable rendered video.
- `/projects` local history backed by IndexedDB, including persisted rendered blobs, metadata and download links after refresh.
- `/settings` placeholder for future local voice/model integrations.
- Vercel deployment through GitHub using `vercel.json`.

## Current Limits

- The deployed MVP exports WebM in Chromium-based browsers. MP4 depends on browser MediaRecorder support.
- There is no authentication yet.
- There is no hosted Rust API or worker in the Vercel deployment.
- TTS, LLM, Whisper timestamps and FFmpeg server-side MP4 rendering are planned for the backend phase.

## Stack

- Frontend: Vite, TypeScript and TailwindCSS.
- Browser render: Canvas, HTMLMediaElement, MediaRecorder and IndexedDB.
- Backend crates: Rust workspace scaffold for API, worker, renderer, captions, media core, TTS stubs and shared types.
- Future backend services: PostgreSQL, Redis and FFmpeg.

## Run Locally

```powershell
cd apps/web
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```powershell
cd apps/web
npm run build
```

## Deploy Frontend To Vercel Through GitHub

This repository includes `vercel.json` so Vercel can deploy the web app from the monorepo root.

1. Push the repository to GitHub.
2. In Vercel, import the GitHub repository.
3. Keep the project root as the repository root.
4. Vercel will use:
   - Install command: `cd apps/web && npm install`
   - Build command: `cd apps/web && npm run build`
   - Output directory: `apps/web/dist`

## Browser MVP Flow

1. Open `/create`.
2. Write the title and script.
3. Choose format and caption style.
4. Upload a voice audio file.
5. Upload a background video.
6. Click `Gerar video`.
7. Download the generated file.
8. Open `/projects` to find the local persisted history.

## Backend Phase

The original full PsikoRender target remains:

- Axum API for projects, uploads, captions and render jobs.
- Redis queue for non-blocking renders.
- Worker process that generates captions, calls FFmpeg and updates status.
- PostgreSQL metadata storage.
- Local or object storage for uploaded and generated media.
- FFmpeg MP4 output with ASS captions.
- Local TTS connectors for XTTS-v2, F5-TTS, Piper and OpenVoice.

Those pieces need a container/VPS/backend host rather than Vercel's static frontend runtime.
