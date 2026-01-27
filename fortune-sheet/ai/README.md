# FortuneSheet AI Service

This is a **separate AI service** that connects to FortuneSheet to extract sheet data for AI processing.

## Architecture

```
FortuneSheet App (Browser - Port 3000) 
    ↓ (sends data via HTTP)
AI API Server (Node.js/Express - Port 5000)
    ↓ (provides APIs)
AI Client (Python) - Connects to API Server
```

## Setup

### 1. Install Dependencies

```bash
cd ai
npm install
```

### 2. Start the AI API Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

The server will start on `http://localhost:5000`

### 3. Start the FortuneSheet Application

In the main fortune-sheet directory:

```bash
yarn app
```

The app will start on `http://localhost:3000` and automatically connect to the AI service.

## API Endpoints

The AI service exposes these endpoints:

- `GET /api/health` - Health check
- `GET /api/sheets` - List all sheets
- `GET /api/sheet/:id` - Get sheet by ID (full data)
- `GET /api/sheet/:id/celldata` - Get sheet by ID (non-empty cells only)
- `GET /api/sheet/index/:index` - Get sheet by index (full data)
- `GET /api/sheet/index/:index/celldata` - Get sheet by index (non-empty cells only)
- `POST /api/workbook/update` - Update workbook data (called by app)

## Usage

### Python Client

The Python test script can be extended to connect to this API:

```python
import requests

# Get all sheets
response = requests.get("http://localhost:5000/api/sheets")
sheets = response.json()

# Get sheet with non-empty cells only
response = requests.get("http://localhost:5000/api/sheet/sheet-1/celldata")
sheet_data = response.json()
```

### Direct API Calls

```bash
# Health check
curl http://localhost:5000/api/health

# Get all sheets
curl http://localhost:5000/api/sheets

# Get sheet by ID (non-empty cells)
curl http://localhost:5000/api/sheet/sheet-1/celldata
```

## How It Works

1. **FortuneSheet App** runs on port 3000
2. **AI Service** runs on port 5000
3. The app automatically syncs data to the AI service when changes occur
4. The AI service provides APIs to access sheet data
5. Python scripts or other AI tools can connect to the AI service

## Integration

The app includes `ai_client.js` which:
- Automatically connects to the AI service on startup
- Syncs workbook data when changes occur
- Provides access to sheet data via the API

## Next Steps

1. Add AI model integration (OpenAI, Anthropic, etc.)
2. Add context extraction utilities
3. Add AI-powered features (formula suggestions, data analysis, etc.)
4. Connect to actual AI services
