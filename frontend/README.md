# RIA frontend

The Next.js App Router frontend for the Research Intelligence Agent. It connects to the FastAPI backend at `http://localhost:8000` by default; change `NEXT_PUBLIC_API_BASE_URL` in `.env.local` when using a different API origin.

## Run locally without Docker

Start the backend first by following the **Run locally without Docker (Windows)** steps in the repository-root [README](../README.md). In a second PowerShell terminal:

```powershell
Set-Location 'C:\Users\neju\Desktop\project\RAG\frontend'
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Open `http://localhost:3000`. The frontend connects to the API at `http://localhost:8000` by default; change `NEXT_PUBLIC_API_BASE_URL` in `.env.local` only if you run the API at a different address. Keep the backend terminal open too. Stop each server with **Ctrl+C** in its own terminal.

The browser sends the backend's HttpOnly session cookies and CSRF header; no API or session secrets are stored in browser storage.

## Workspace

- Ask general questions as a guest without an account; guest questions are not saved and do not use private documents.
- After signing in, manage collections and upload documents or URLs at `/workspace`. Successful ingestion submissions open `/workspace/chat`.
- The chat sidebar lists saved conversations and includes a back link to the collections and source-upload page.
- Private collections can be created, renamed, and deleted.
- Upload PDF, DOCX, TXT, and Markdown files or submit public URLs. Ingestion status and safe failure messages are shown.
- Select one or more collections as the research scope; the backend independently enforces ownership.
- Ask questions in saved conversations and inspect the source excerpt, page number, and URL behind each returned citation.
- Copy any message, or edit a user question to replace it and regenerate its answer. Editing removes later messages in that conversation.

Google sign-in, email password recovery, collection sharing, deep research, and report export are not part of this MVP.

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` in this folder to validate frontend changes.
