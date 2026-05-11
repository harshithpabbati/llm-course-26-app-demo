# ◈ DataLens AI

> Upload any CSV. Ask anything in plain English. Get instant, sandboxed visualizations powered by a local LLM.

---

## What It Does

DataLens AI is a full-stack data visualization agent. You upload a CSV file, type a natural language question like *"bar chart of mean left max force per subject"*, and the app:

1. Sends your question + dataset schema to a **local LLM** (via Ollama — your data never leaves your machine)
2. Extracts the generated Python code
3. Runs it inside an **isolated E2B cloud sandbox** (so no untrusted code ever touches your server)
4. Returns the chart, code, and LLM response back to your browser

---

## Architecture

```
Browser (React + Vite)
        │
        │  REST API (JSON)
        ▼
FastAPI Backend
  ├── POST /api/analysis/upload   → parse CSV, create session
  └── POST /api/analysis/run      → prompt LLM → execute in sandbox → return chart
        │                                  │
        ▼                                  ▼
 Ollama (local LLM)             E2B Cloud Sandbox
 runs on your machine           isolated Python VM
 data stays private             safe code execution
```

### Backend Layer Structure

```
backend/
├── main.py                  FastAPI app entry point, CORS
├── core/
│   └── config.py            Settings loaded from .env
├── models/
│   └── schemas.py           Pydantic request/response types
├── routers/
│   ├── health.py            GET  /api/health
│   └── analysis.py          POST /api/analysis/upload|run
└── services/
    ├── dataset_service.py   CSV parsing, column normalization, session store
    ├── llm_service.py       Ollama async call, code block extraction
    └── sandbox_service.py   E2B execution, PNG capture
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, CSS Modules |
| Backend | FastAPI, Uvicorn, Pydantic v2 |
| LLM | Ollama (local, on-premises) |
| Code Execution | E2B Code Interpreter (sandboxed VM) |
| Data | Pandas, Matplotlib, Seaborn |

---

## Prerequisites

| Tool | Purpose | Install |
|---|---|---|
| Python 3.11+ | Backend runtime | [python.org](https://python.org) |
| Node.js 20+ | Frontend build | [nodejs.org](https://nodejs.org) |
| Ollama | Local LLM runner | [ollama.com/download](https://ollama.com/download) |
| E2B API key | Sandboxed execution | [e2b.dev](https://e2b.dev) — free tier works |

---

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/ai-data-viz-agent.git
cd ai-data-viz-agent
```

### 2. Pull a model

```bash
ollama pull qwen2.5-coder:7b   # recommended
```

### 3. Start the backend

```bash
cd backend
cp .env.example .env           # add your E2B_API_KEY inside
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 5. Use the app

- Paste your E2B key in the sidebar
- Select a model
- Drag and drop a CSV file
- Type a question and hit Analyze (or press ⌘ Enter)

---

## Docker (optional)

```bash
# Ollama must already be running natively on your machine
E2B_API_KEY=your_key_here docker compose up
```

Opens at `http://localhost:5173`. No manual Python or Node install needed.

---

## Supported Models

| Model | Pull Command | Best For |
|---|---|---|
| **Qwen 2.5 Coder 7B** ⭐ | `ollama pull qwen2.5-coder:7b` | Best code quality, most reliable |
| DeepSeek Coder V2 8B | `ollama pull deepseek-coder-v2:8b` | Complex queries, edge cases |
| Llama 3.1 8B | `ollama pull llama3.1:8b` | Good general fallback |
| Mistral 7B | `ollama pull mistral:latest` | Flexible, general use |
| DeepSeek R1 7B | `ollama pull deepseek-r1:7b` | Multi-step reasoning (slow) |
| Llama 3.2 3B | `ollama pull llama3.2:latest` | Fastest, low-RAM machines |

---

## Example Queries

**Safe to start with (always work):**
```
Heatmap of correlations between all numeric columns
```
```
Bar chart of mean left max force per subject
```
```
Single bar chart showing overall average of each numeric column
```

**Intermediate:**
```
For each subject, plot mean left and right max force as a grouped bar chart
```
```
Histogram of all left max force values using 10 bins
```
```
Box plot comparing left avg force and right avg force side by side
```

**Advanced:**
```
For each subject, calculate asymmetry index as
(leftmaxforce - rightmaxforce) / (leftmaxforce + rightmaxforce) * 100,
plot as horizontal bar chart sorted by asymmetry
```
```
Line chart of left max force over time for the top 3 subjects by mean force
```

**Tips:**
- Always say **mean**, **average**, or **top N** to avoid dense overcrowded charts
- Say **top 5** or **top 10** instead of "all subjects" for bar charts
- Add **"just 2 bars"** for the simplest possible comparison

---

## How It Works Internally

### 1. Upload
CSV is parsed by Pandas. Column names are normalized (lowercased, spaces replaced with underscores). A session UUID is created and the dataframe and raw bytes are stored in memory.

### 2. Schema-aware prompting
The backend builds a schema summary with column names, dtypes, and sample values. This is injected into the LLM system prompt so the model knows exactly what columns exist — preventing hallucinated column names.

### 3. Code generation
The local Ollama model receives the schema and user query and returns Python code inside a fenced code block. A regex extractor pulls just the code, stripping all explanation text.

### 4. Sandboxed execution
The CSV bytes and generated code are uploaded to an E2B micro-VM. The code runs in total isolation — if the LLM generated malicious code, it cannot touch your server. The sandbox intercepts `plt.show()` and returns the chart as a base64 PNG.

### 5. Display
The React frontend shows the chart in the Chart tab, the Python code in the Code tab, and the full LLM response in the LLM Response tab. Execution time is shown in the status bar.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/analysis/upload` | Upload CSV, returns session_id and schema metadata |
| POST | `/api/analysis/run` | Run NL query, returns chart PNG, code, and timing |

Full interactive docs available at `http://localhost:8000/docs`.

---

## Troubleshooting

| Error | Fix |
|---|---|
| 422 Unprocessable Entity | Check E2B key is entered in the sidebar; check model name is valid |
| LLM error / connection refused | Run `ollama serve` in a terminal |
| Session not found | Re-upload the CSV — sessions reset on page refresh |
| Sandbox timeout | Try a simpler query first; E2B free tier can be slow on cold start |
| Dense unreadable chart | Add "top 5" or "mean per subject" to reduce data points |
| Pivot / reshape error | Add "mean" or "average" to your query — data has multiple rows per subject |
| Port conflict | Change `--port 8001` in uvicorn and update the proxy target in `vite.config.js` |

---

## Security

- **No cloud LLM calls** — all inference runs locally via Ollama; your CSV never leaves your machine
- **Sandboxed execution** — LLM-generated code runs in E2B's isolated VM, not on your server
- **No disk persistence** — sessions are in-memory only; CSV bytes are never written to disk

---

## Disclaimer

This project is for educational and experimental purposes. It is not a production-ready tool. Handle sensitive datasets responsibly.
