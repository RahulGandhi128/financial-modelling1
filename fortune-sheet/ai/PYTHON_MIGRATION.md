# Python LLM Migration

All LLM/AI-related code has been migrated from JavaScript to Python.

## New Structure

### Python Files (LLM Core)
- **`api_client.py`** - FortuneSheet API client for Python
- **`llm_tools.py`** - Tool registry and executor (MCP-style tools)
- **`gemini_service.py`** - Gemini 2.5 Flash service with agent loop
- **`llm_server.py`** - Flask HTTP server for LLM endpoints

### JavaScript Files (API & Frontend)
- **`api_server.js`** - Main API server (receives data from FortuneSheet app)
- **`ai_client.js`** - Browser-side client (syncs data to AI service)
- **`llm_chat.html`** - Chat interface (connects to Python LLM server)

### Removed Files
- ❌ `gemini_service.js` - Migrated to `gemini_service.py`
- ❌ `llm_tools.js` - Migrated to `llm_tools.py`
- ❌ `llm_server.js` - Migrated to `llm_server.py`
- ❌ `api_client.js` - Migrated to `api_client.py`

## Setup

### Install Python Dependencies
```bash
cd fortune-sheet/ai
pip install -r requirements.txt
```

### Environment Variables
Create a `.env` file:
```
GEMINI_API_KEY=your_api_key_here
API_URL=http://localhost:5000
LLM_PORT=5001
```

## Running the Services

### 1. Start API Server (Node.js)
```bash
npm start
# or
npm run dev
```
Runs on port 5000 - receives data from FortuneSheet app

### 2. Start LLM Server (Python)
```bash
python llm_server.py
# or
npm run llm
```
Runs on port 5001 - handles LLM requests

### 3. Open Chat Interface
Open `llm_chat.html` in a browser or serve it via a web server.

## Key Features

### Agent Loop
The Python `gemini_service.py` implements an agent loop that:
- Breaks complex tasks into smaller steps
- Executes tools sequentially
- Continues until task is complete (max 10 iterations)
- Prevents `MALFORMED_FUNCTION_CALL` errors from oversized JSON

### Tool Registry
All tools are defined in `llm_tools.py`:
- `get_all_sheets` - List all sheets
- `get_excel_tables` - Get sheet data in table format
- `set_from_table` - Write data using table format (primary method)
- `set_cell` - Set single cell
- `set_cells` - Set multiple cells
- `create_sheet` - Create a new sheet in the workbook

### API Endpoints (Python Server)
- `POST /api/chat` - Chat with Gemini
- `POST /api/process-table` - Process query expecting table output
- `POST /api/apply-table` - Apply table data to spreadsheet
- `GET /api/tools` - List available tools
- `GET /api/health` - Health check
- `GET /api/explain` - Framework explanation

## Architecture

```
FortuneSheet App (React)
    ↓ (sends data)
API Server (Node.js) - port 5000
    ↓ (stores data)
LLM Server (Python) - port 5001
    ↓ (calls tools)
API Server (Node.js) - port 5000
    ↓ (queues updates)
FortuneSheet App (React) - polls for updates
```

## Benefits of Python Migration

1. **Better for AI/ML** - Python ecosystem is stronger for LLM integration
2. **Agent Loop** - Easier to implement multi-step agent logic in Python
3. **Tool Management** - Cleaner tool registry and execution
4. **Error Handling** - Better error handling and debugging
5. **Future-Proof** - Easier to add more AI features (embeddings, vector DBs, etc.)

