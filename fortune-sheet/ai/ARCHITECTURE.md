# FortuneSheet AI Service Architecture

## Overview
This document explains how the AI service integrates with the FortuneSheet application and how all components work together.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FortuneSheet App                         │
│                  (React + Vite, Port 3000)                  │
│                                                             │
│  ┌──────────────┐         ┌──────────────────┐            │
│  │   App.tsx    │────────▶│  ai_client.js    │            │
│  │              │         │  (Browser Client)│            │
│  └──────────────┘         └────────┬─────────┘            │
│                                    │                       │
│                                    │ HTTP POST             │
│                                    │ /api/workbook/update  │
└────────────────────────────────────┼───────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│              AI Service API Server                           │
│              (Node.js + Express, Port 5000)                 │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │              api_server.js                         │    │
│  │  - Stores workbook data in memory                  │    │
│  │  - Provides REST API endpoints                     │    │
│  │  - Processes Excel-like table formatting           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │              utils.js                               │    │
│  │  - Helper functions for data conversion            │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTP GET
                                     │ /api/sheet/:id/excel-tables
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Python Test Client                             │
│              (test_apis.py)                                 │
│                                                             │
│  - Tests the Excel tables API                              │
│  - Displays formatted tables in terminal                   │
│  - Validates API responses                                 │
└─────────────────────────────────────────────────────────────┘
```

## File Structure and Purpose

### `/ai` Folder Contents

#### 1. **`api_server.js`** - Main API Server
**Purpose**: Node.js/Express server that acts as the AI service backend

**What it does**:
- Runs on `http://localhost:5000`
- Receives workbook data from the FortuneSheet app via `POST /api/workbook/update`
- Stores data in memory (in production, this would connect to a database)
- Provides REST API endpoints:
  - `GET /api/health` - Health check
  - `GET /api/sheets` - Get list of all sheets
  - `GET /api/sheet/:id/excel-tables` - Get Excel-like tables (values & formulas)
- Converts internal cell data format to Excel-style tables (A1, B2, etc.)
- Handles formula extraction and formatting

**Key Functions**:
- `indexToColumnChar(index)` - Converts 0,1,2... to A,B,C... (Excel column letters)
- `getCellReference(row, col)` - Converts row/col indices to Excel references (A1, B2, etc.)
- Excel tables endpoint processes data and returns two tables:
  - `values_table`: Shows actual cell values
  - `formulas_table`: Shows formulas where they exist, otherwise values

---

#### 2. **`ai_client.js`** - Browser Client (in `/public/ai/`)
**Purpose**: JavaScript client that runs in the browser to connect the FortuneSheet app to the AI service

**What it does**:
- Automatically loads when the FortuneSheet app starts
- Connects to the AI service API server (`http://localhost:5000`)
- Sets up `window.aiService` object that the React app can use
- Automatically syncs workbook data to the AI service whenever data changes
- Handles connection retries if the AI service isn't immediately available

**Key Features**:
- `onDataChange(data)` - Called by the app when data changes, sends it to AI service
- `onOp(ops)` - Called when operations occur (currently not used, but available)
- Auto-initialization with retry logic

**How it connects**:
1. Script loads in browser when app starts
2. Waits for DOM to be ready
3. Tries to connect to AI service
4. If connected, sets up `window.aiService` interface
5. App uses this interface to send data updates

---

#### 3. **`test_apis.py`** - Python Test Script
**Purpose**: Test client to interact with the AI service API

**What it does**:
- Connects to the AI service API server
- Tests the Excel tables endpoint
- Displays formatted tables in the terminal (markdown-like format)
- Validates API responses

**Key Features**:
- `FortuneSheetAIClient` class - Python client for API calls
- `print_excel_table()` - Formats and displays tables nicely
- Interactive menu to run tests
- Shows both values table and formulas table

**Usage**:
```bash
cd ai
python test_apis.py
```

---

#### 4. **`utils.js`** - Utility Functions
**Purpose**: Helper functions for data conversion

**What it does**:
- `dataToCelldata(data)` - Converts 2D cell matrix to sparse celldata format
- Currently not used in the simplified version, but kept for potential future use

---

#### 5. **`package.json`** - Node.js Dependencies
**Purpose**: Defines Node.js dependencies and scripts

**Dependencies**:
- `express` - Web server framework
- `cors` - Cross-Origin Resource Sharing middleware

**Scripts**:
- `npm start` - Start the API server
- `npm run dev` - Start with auto-reload (nodemon)

---

#### 6. **`requirements.txt`** - Python Dependencies
**Purpose**: Defines Python dependencies for the test script

**Dependencies**:
- `requests` - HTTP library for API calls

---

## Data Flow

### 1. **Initial Setup**
```
1. User starts FortuneSheet app (yarn app)
   └─> App loads in browser (http://localhost:3000)
   └─> ai_client.js script loads automatically
   └─> ai_client.js tries to connect to AI service

2. User starts AI service (npm start in ai folder)
   └─> API server starts on http://localhost:5000
   └─> Server is ready to receive data
```

### 2. **Data Synchronization**
```
User enters data in FortuneSheet
   └─> App.tsx onChange() callback fires
   └─> Calls window.aiService.onDataChange(newData)
   └─> ai_client.js sends POST to /api/workbook/update
   └─> api_server.js receives data and stores in memory
   └─> Data is now available for API queries
```

### 3. **Getting Excel Tables**
```
User runs test_apis.py
   └─> Python script calls GET /api/sheets (get sheet list)
   └─> Python script calls GET /api/sheet/:id/excel-tables
   └─> api_server.js processes data:
       - Finds all non-empty cells
       - Converts to Excel coordinates (A1, B2, etc.)
       - Builds two tables (values & formulas)
   └─> Returns JSON response
   └─> Python script formats and displays tables
```

## Key Concepts

### Excel-Style Coordinates
- **Rows**: 1-based (1, 2, 3...) instead of 0-based (0, 1, 2...)
- **Columns**: Letters (A, B, C... Z, AA, AB...) instead of numbers (0, 1, 2...)
- **Cell References**: A1, B2, C3, etc.

### Two Table Formats
1. **Values Table**: Shows the actual calculated/displayed values
2. **Formulas Table**: Shows formulas where they exist, otherwise shows values

### Data Storage
- AI service stores data in memory (`workbookData` array)
- Data is updated whenever the app sends changes
- In production, this would connect to a database

## How to Use

### Starting Everything
1. **Start AI Service**:
   ```bash
   cd ai
   npm install  # First time only
   npm start
   ```

2. **Start FortuneSheet App** (in another terminal):
   ```bash
   cd fortune-sheet
   yarn app
   ```

3. **Test the API** (in another terminal):
   ```bash
   cd ai
   python test_apis.py
   ```

### Workflow
1. Open FortuneSheet app in browser
2. Enter data and formulas in the spreadsheet
3. Data automatically syncs to AI service
4. Run Python test script to see Excel tables
5. Tables show both values and formulas in Excel-like format

## API Endpoints

### Essential Endpoints (Kept)

1. **POST `/api/workbook/update`**
   - Receives workbook data from FortuneSheet app
   - Updates in-memory storage
   - Called automatically when data changes

2. **GET `/api/sheets`**
   - Returns list of all sheets with IDs and names
   - Used by test script to get sheet list

3. **GET `/api/sheet/:id/excel-tables`**
   - Main endpoint for getting Excel-like tables
   - Returns values table and formulas table
   - Includes Excel-style coordinates (A1, B2, etc.)

4. **POST `/api/sheets`**
   - Create a new sheet in the workbook
   - Accepts optional `name` and `order` parameters
   - Returns the new sheet's ID and name
   - Used by LLM to create new sheets for organizing data

5. **GET `/api/health`**
   - Health check endpoint
   - Used to verify AI service is running

## Troubleshooting

### AI Service Not Connecting
- Check if API server is running: `http://localhost:5000/api/health`
- Check browser console for connection errors
- Verify CORS is enabled in api_server.js

### No Data in Tables
- Make sure you've entered data in the FortuneSheet app
- Check that data sync is working (browser console should show "Data synced to AI service")
- Verify sheet ID is correct

### Python Script Errors
- Make sure AI service is running
- Check that `requests` library is installed: `pip install requests`
- Verify sheet exists: check `/api/sheets` endpoint

## Future Enhancements

- Connect to database instead of in-memory storage
- Add authentication/authorization
- Support for multiple workbooks
- Real-time updates via WebSockets
- More advanced formula analysis
- Export to various formats (CSV, Excel, etc.)

