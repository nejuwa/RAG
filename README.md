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
- In the Docker profile, ingestion jobs use Redis/RQ. Local mode and the single-service free deployment can run ingestion as API background tasks with `INGESTION_MODE=inline`. Chunk vectors are stored in Qdrant; source metadata, text, users, and conversations are stored in PostgreSQL.
- Retrieval combines Qdrant cosine search with a BM25-style lexical ranker and reciprocal-rank fusion. Gemini creates embeddings and generates answers.
- Citation labels are accepted only when they map to evidence retrieved for that request. If the model provides no valid evidence labels, its uncited output is not shown as a supported answer.
- This initial slice does not include collection sharing, deep-research planning, OCR, password reset/email, Google sign-in, administration, or report export. Review provider privacy, credentials, quotas, HTTPS, and backups before production use.

Configuration variables and safe local defaults are listed in `.env.example`. Never commit `.env` or provider credentials.

## Free-tier deployment with Vercel and Render

This is a low-traffic personal/demo setup, not production-reliable hosting. It uses a Vercel Hobby frontend, one Render Free API, Neon Free PostgreSQL, Qdrant Cloud Free, and Gemini API free-tier models. Uploaded originals use Render's temporary filesystem, so no S3/R2 account is required. Provider limits and terms can change. Staying within free allowances is required to remain at $0; exceeding allowances or choosing paid resources may incur charges. Do not add a payment method or enable paid upgrades if you cannot accept any charges.

Render's Free web service sleeps after inactivity and has ephemeral local storage. Its Free PostgreSQL expires after 30 days, so use Neon instead. Inline ingestion runs as an API background task and avoids Redis and a separate paid worker, but a restart during indexing can interrupt that job. Uploaded original files can disappear when Render sleeps, restarts, or redeploys. Once indexing completes, the extracted text and vectors are stored in Neon and Qdrant and remain available for retrieval; the original upload is not durable.

### 1. Push the free-ingestion code to GitHub

The Render Blueprint now configures only a Free web service and sets `INGESTION_MODE=inline`. Commit and push the deployment changes from the project root. Do not stage `.env`, `frontend/.env.local`, virtual environments, or generated data:

```powershell
git status --short
git add README.md render.yaml backend/app/settings.py backend/app/jobs.py backend/app/main.py backend/app/worker.py backend/tests/test_core.py backend/tests/test_api.py
git diff --cached --check
git commit -m "Support free single-service deployment"
git push origin main
```

### 2. Create the free provider resources

1. **Neon:** create a Free project and PostgreSQL database. Copy its connection string; keep it private.
2. **Qdrant Cloud:** create a Free cluster and API key. Keep the cluster URL and key.
3. **Google AI Studio:** create a Gemini API key. Confirm the selected generation and embedding models are available to the free API tier, and review the free-tier data terms before sending documents.

Use only plans labeled Free. If a provider asks for billing details, check that a free-only account is possible and disable upgrades/usage-based billing before continuing. A free-tier label alone does not guarantee that out-of-quota usage cannot be billed.

### 3. Deploy the API on Render

1. In Render, create a Blueprint connected to `nejuwa/RAG` on branch `main`. Render reads the root `render.yaml`, which now declares one `ria-api` web service with `plan: free`; it does not provision databases, Qdrant, or R2.
2. In the Render `ria-production` environment group, set:
   - `DATABASE_URL`: Neon PostgreSQL connection string. The app normalizes `postgres://` and `postgresql://` prefixes for psycopg 3.
   - `QDRANT_URL` and `QDRANT_API_KEY`: Qdrant Free cluster details.
   - `GEMINI_API_KEY`: Google AI Studio key.
   - `CORS_ORIGINS`: set this to the final Vercel origin after step 4, such as `https://your-project.vercel.app`, with no trailing slash.
3. Keep Blueprint values `RIA_ENV=production`, `INGESTION_MODE=inline`, `COOKIE_SECURE=true`, and `UPLOAD_STORAGE=local`. Render generates the private `SECRET_KEY`. No Redis URL, worker, S3 account, or S3 credentials are needed in this mode.
4. Deploy the service and copy its public URL, for example `https://ria-api-xxxx.onrender.com`. Visit `/health`; it should show `"status":"ok"` and `"queue":"inline"`. If it fails, inspect Render logs and confirm that all provider environment variables are set.

### 4. Deploy the frontend on Vercel

1. Import `nejuwa/RAG` into Vercel and set **Root Directory** to `frontend`.
2. Add `RIA_BACKEND_ORIGIN` for the **Production** environment, set to the Render API origin with no trailing slash, e.g. `https://ria-api-xxxx.onrender.com`. Leave `NEXT_PUBLIC_API_BASE_URL` unset.
3. Deploy and note the production Vercel URL, e.g. `https://your-project.vercel.app`. Use the production URL for testing; Preview deployments may have different origins and are not configured here.

### 5. Finish CORS and test

1. In Render, set `CORS_ORIGINS` to the exact Vercel production origin. Save and redeploy the API if prompted.
2. Open the Vercel URL, register, create a collection, upload a small document, wait for it to be indexed, and ask a question. Test sign-out and sign-in too.
3. If the API is sleeping, the first request can take about a minute while Render starts it. Check Render logs, `/health`, and provider usage pages when troubleshooting.

Do not commit provider credentials or either local `.env` file. Local accounts/data are not migrated. Monitor free quotas, and remember that inline jobs may be interrupted if the free API restarts while processing.