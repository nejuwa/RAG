# Research Intelligence Agent (RIA)

RIA is an MVP implementation of the Multi-Source Research Intelligence Agent SRS. It provides private collections, asynchronous PDF/DOCX/TXT/Markdown and public-web ingestion, hybrid semantic/keyword retrieval, and answers with evidence-linked citations. Visitors can also ask general questions without an account; guest questions are not saved and do not use private documents.

## Run locally without Docker (Windows)

The local profile uses your PostgreSQL database and an embedded, on-disk Qdrant index. Ingestion runs in the API process, so Docker, Redis, and a separate worker are not required. PostgreSQL must be installed and running on your computer, and the database `rag` must exist. Run the backend and frontend in two separate PowerShell terminals.

### 1. Check prerequisites

Install Python 3.12 or newer and Node.js 22 or newer. Check that PowerShell can find them:

```powershell
python --version
node --version
npm --version
```

### 2. Configure the API

Open PowerShell in the project root:

```powershell
Set-Location 'C:\Users\neju\Desktop\project\RAG'
```

If you do not already have a `.env` file, create one from the example. **Do not overwrite an existing `.env`**; it may contain your private credentials.

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

In `.env`, set `GEMINI_API_KEY` to your Google AI Studio API key, `SECRET_KEY` to a private, random value at least 32 characters long, and `DATABASE_URL` to your PostgreSQL connection. For a local PostgreSQL account named `postgres` with a password, use:

```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/rag
```

Replace `YOUR_POSTGRES_PASSWORD` with the password for your PostgreSQL user. If your PostgreSQL username, password, port, or database name differs, update the URL accordingly. URL-encode special characters in the password. Do not share or commit `.env`.

### 3. Start the backend (first PowerShell terminal)

From the project root, create a Python virtual environment and install the backend packages:

```powershell /rag
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
```

If PowerShell blocks virtual-environment activation, allow it for this terminal only, then activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
backend\.venv\Scripts\Activate.ps1
```

Start the API in local mode:

```
Set-Location 'C:\Users\neju\Desktop\project\RAG'
$env:RIA_ENV = "local"
$env:QDRANT_LOCAL_PATH = "data/qdrant"
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Set-Location .\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Keep this terminal open. If the database cannot be reached, check that PostgreSQL is running and that the connection URL in `.env` is correct. The API should be available at `http://localhost:8000`; its interactive docs are at `http://localhost:8000/docs`. You can check readiness at `http://localhost:8000/health`.

### Gemini model returns HTTP 404

The configured answer model must be listed for your Gemini API key and support `generateContent`. To see the exact model IDs available to your configured key, open a third PowerShell terminal:

```powershell
Set-Location 'C:\Users\neju\Desktop\project\RAG\backend'
.\.venv\Scripts\python.exe -m app.list_models
```

The command reads `GEMINI_API_KEY` from the root `.env` and prints only model IDs; it does not print the key. Copy one of the returned IDs exactly into `GEMINI_MODEL` in the root `.env` (do not include `models/`), then restart the backend. If the command reports that the key was rejected, check the key in `.env` without sharing it.

### Gemini answer request times out

The backend allows up to 180 seconds for answer generation and 90 seconds for embeddings by default. It retries one time on provider timeouts, temporary network errors, HTTP 429, and temporary HTTP 5xx errors. If failures continue, check your internet connection and Google AI Studio status/quota. You can adjust `GEMINI_ANSWER_TIMEOUT_SECONDS` in `.env` (allowed range: 1–600 seconds) and `GEMINI_MAX_RETRIES` (0–3), then restart the backend. Increasing retries/timeouts cannot resolve a persistent provider outage or quota restriction.

### 4. Start the frontend (second PowerShell terminal)

Open a second PowerShell window:

```powershell
Set-Location 'C:\Users\neju\Desktop\project\RAG\frontend'
npm ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm run dev
```

Keep this terminal open and open `http://localhost:3000` in your browser. Select **Ask** for an unsaved general question without creating an account, or create an account to open the collections page. Add a PDF, DOCX, TXT, or Markdown file or public URL to move into chat; wait for its source status to become **indexed** before asking a question grounded in your sources. Use the chat sidebar to switch conversations or return to collections.

Press **Ctrl+C** in each terminal to stop its server. PostgreSQL stores the application records; the local vector index and uploaded files are stored under `backend\data`. Start the backend from the `backend` directory as shown above so the vector and upload paths resolve consistently.

## Run with Docker Compose

1. Copy `.env.example` to `.env`.
2. Replace `SECRET_KEY` with a random value of at least 32 characters and set `POSTGRES_PASSWORD`.
3. Set `GEMINI_API_KEY` to a Google AI Studio API key. The API can start without it, but indexing and grounded research require it.
4. Run:

   ```powershell
   docker compose up --build
   ```

5. Open `http://localhost:3000`, register an account, upload documents or add public URLs, wait for their status to become **indexed**, then ask a question in the selected collection.

The API is available at `http://localhost:8000`; its interactive API documentation is at `http://localhost:8000/docs`. `GET /health` checks the database and vector store.

## Local API tests

Use Python 3.12. From the repository root:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m pytest backend\tests
```

The tests cover API authorization, citations, file validation, safe URL checks, parsers, chunking/provenance, and password hashing. The isolated automated tests use SQLite; the application itself requires PostgreSQL. The Docker profile uses PostgreSQL, Qdrant, and Redis.

## MVP behavior and limits

- Every collection is private and owned by one account. Server routes verify ownership before source access and retrieval.
- Supported uploads are PDF, DOCX, TXT, and Markdown, up to 20 MB and 500 PDF pages by default. PDF page numbers and available headings are retained. OCR is not included.
- URL ingestion fetches one public HTTP/HTTPS page, checks robots.txt, blocks non-public IP destinations, limits redirects/time/response size, rate-limits each domain, and does not crawl linked pages.
- In the Docker profile, ingestion jobs use Redis/RQ; in local mode, ingestion runs as an API background task. Chunk vectors are stored in Qdrant; source metadata, text, users, and conversations are stored in PostgreSQL.
- Retrieval combines Qdrant cosine search with a BM25-style lexical ranker and reciprocal-rank fusion. Gemini creates embeddings and generates answers.
- Citation labels are accepted only when they map to evidence retrieved for that request. If the model provides no valid evidence labels, its uncited output is not shown as a supported answer.
- This initial slice does not include collection sharing, deep-research planning, OCR, password reset/email, Google sign-in, administration, or report export. Review provider privacy, credentials, quotas, HTTPS, and backups before production use.

Configuration variables and safe local defaults are listed in `.env.example`. Never commit `.env` or provider credentials.

## Deploy to Vercel and Render

The frontend is hosted on Vercel and the FastAPI API plus ingestion worker run on Render. Production requires hosted PostgreSQL, Redis/Key Value, Qdrant Cloud, and an S3-compatible bucket because Render's local filesystem is not shared or durable across service instances. This repository includes a Render Blueprint in `render.yaml`; the database, Redis, Qdrant, and object-storage accounts are created separately.

**Review provider pricing before provisioning anything.** Render services and hosted databases/Redis, Qdrant, and object storage may incur charges. Do not put credentials in this repository, Vercel source, or chat.

### 1. Push the project to a private GitHub repository

The project must be pushed to GitHub before Vercel and Render can deploy it. From PowerShell in the project root, check that `.env`, `.env.local`, virtual environments, and generated data are not staged. Then initialize and push the project using the URL of a new private GitHub repository:

```powershell
git init
git add .
git status
git commit -m "Prepare RIA deployment"
git branch -M main
git remote add origin https://github.com/YOUR_ACCOUNT/YOUR_PRIVATE_REPOSITORY.git
git push -u origin main
```

If Git reports that an identity is not configured, set `user.name` and `user.email` locally before committing. Never force-push over a repository that already contains work.

### 2. Create the hosted services

1. Create a PostgreSQL database and a Redis-compatible service (Render Key Value or another managed Redis provider). Choose plans based on your needs and budget. Copy the PostgreSQL **internal** connection string and Redis **internal** URL; keep them private.
2. Create a Qdrant Cloud cluster and collection access key. Copy the cluster URL and API key.
3. Create an S3-compatible bucket and access credentials restricted to that bucket. For Cloudflare R2, set `S3_REGION=auto` and `S3_ENDPOINT_URL` to the account's S3 API endpoint. For AWS S3, use the bucket's AWS region and leave the endpoint URL empty.

### 3. Deploy the backend on Render

1. In Render, create a Blueprint from the GitHub repository and select the repository's `render.yaml`. The Blueprint defines the `ria-api` web service and `ria-worker` background worker; it does not provision PostgreSQL, Redis, Qdrant, or a bucket.
2. In the Render `ria-production` environment group, set the requested values:
   - `DATABASE_URL`: hosted PostgreSQL connection string. Use the provider's internal URL as provided; the app normalizes `postgres://` and `postgresql://` to the installed psycopg 3 driver.
   - `REDIS_URL`: the Redis provider's internal connection URL.
   - `QDRANT_URL` and `QDRANT_API_KEY`: Qdrant Cloud connection details.
   - `GEMINI_API_KEY`: a key with access to the configured answer and embedding models.
   - `CORS_ORIGINS`: your deployed Vercel origin, for example `https://your-project.vercel.app` (no trailing slash).
   - `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`: your bucket and its credentials. For AWS, leave `S3_ENDPOINT_URL` empty.
3. Keep `RIA_ENV=production`, `COOKIE_SECURE=true`, and `UPLOAD_STORAGE=s3`; the Blueprint sets these values. The generated `SECRET_KEY` is managed by Render. Apply the same environment group to both services.
4. Deploy the API and worker, then check `https://YOUR_RENDER_API/health`. It should report `"status":"ok"` with database, vector store, and queue checks all available.

Do not use a Render disk or local upload storage for production uploads: the worker must be able to read every file uploaded by the API, and local instance files are not durable/shared.

### 4. Deploy the frontend on Vercel

1. Import the same GitHub repository in Vercel and set **Root Directory** to `frontend`.
2. Add the server-only environment variable `RIA_BACKEND_ORIGIN` to the Vercel deployment environment(s), with the Render API origin, for example `https://YOUR_RENDER_API` (no trailing slash). Redeploy after setting it. The Next.js rewrite proxies `/api/*` through Vercel so browser requests and secure auth cookies remain same-origin.
3. Leave `NEXT_PUBLIC_API_BASE_URL` unset in production. The frontend defaults to relative `/api/*` requests in production and uses `http://localhost:8000` for local development.
4. Open the Vercel URL, register a test account, create a collection, upload a small document, and wait for indexing. Verify a cited answer and sign-out/sign-in to check the secure cookie flow.

### 5. Production notes

- The first deployment starts with empty hosted PostgreSQL and Qdrant services; local accounts, conversations, uploads, and vectors are not migrated automatically.
- Keep backups for PostgreSQL and object storage, monitor the Render worker and provider quotas, and rotate any credentials that may have been exposed.
- Vercel preview deployments should use a separate backend/data environment if they must not access production data.
- For troubleshooting, check Render API/worker logs and `/health` before changing app secrets or redeploying.