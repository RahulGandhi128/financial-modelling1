# Gemini 2.5 Flash LLM Integration

This folder contains a complete LLM integration using Google Gemini 2.5 Flash that can read and write data to FortuneSheet spreadsheets.

## Architecture

```
┌─────────────────────────────────┐
│  Gemini 2.5 Flash LLM           │
│  - Understands table format     │
│  - Uses function calling        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  LLM Tools (MCP-style)          │
│  - get_excel_tables             │
│  - set_from_table               │
│  - set_cell, set_cells          │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  API Client                     │
│  - Connects to API server       │
│  - Handles HTTP requests        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  API Server (Port 5000)         │
│  - Stores spreadsheet data       │
└─────────────────────────────────┘
```

## Files

### Core Files

1. **`api_client.js`** - API client for FortuneSheet API
   - Standalone module (doesn't import from test_apis.py)
   - Essential API functions: getExcelTables, setFromTable, etc.

2. **`llm_tools.js`** - MCP-style tool definitions
   - Defines tools available to the LLM
   - Executes tool calls
   - Converts between formats

3. **`gemini_service.js`** - Gemini 2.5 Flash integration
   - Initializes Gemini with function calling
   - Processes queries with tool execution
   - Teaches LLM about table format

4. **`llm_server.js`** - HTTP server for LLM
   - REST API endpoints
   - Chat interface
   - Table processing

### Test File (Keep Separate)

- **`test_apis.py`** - Python test script (unchanged)
  - Used for testing APIs
  - Not imported by LLM code

## Setup

### 1. Install Dependencies

```bash
cd ai
npm install
```

This installs:
- `@google/generative-ai` - Google Gemini SDK
- `axios` - HTTP client
- `express`, `cors` - Server dependencies

### 2. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key

### 3. Set Environment Variable

**Windows (PowerShell):**
```powershell
$env:GEMINI_API_KEY="your-api-key-here"
```

**Windows (CMD):**
```cmd
set GEMINI_API_KEY=your-api-key-here
```

**Linux/Mac:**
```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or create a `.env` file (not recommended for production):
```
GEMINI_API_KEY=your-api-key-here
```

### 4. Start Services

**Terminal 1 - API Server:**
```bash
cd ai
npm start
```

**Terminal 2 - LLM Server:**
```bash
cd ai
npm run llm
```

**Terminal 3 - FortuneSheet App:**
```bash
cd fortune-sheet
yarn app
```

## Usage

### Web Chat Interface (Recommended)

Open `llm_chat.html` in your browser for an interactive chat interface:

1. Make sure both servers are running:
   ```bash
   # Terminal 1: API Server
   npm start
   
   # Terminal 2: LLM Server
   npm run llm
   ```

2. Open `llm_chat.html` in your browser (double-click the file or use a local server)

3. Start chatting! The interface shows:
   - Your messages
   - LLM responses
   - API calls made by the LLM
   - Table data received (values_table and formulas_table)
   - Full API responses

**Example queries:**
- "Get the data from the first sheet"
- "Build a financial model with revenue projections for 12 months"
- "Create a summary table with totals"
- "Read sheet 1 and calculate percentages"

### HTTP API Endpoints

#### 1. Chat with LLM
```bash
POST http://localhost:5001/api/chat
Content-Type: application/json

{
  "query": "Get the data from the first sheet and calculate the total revenue"
}
```

#### 2. Process Table Query
```bash
POST http://localhost:5001/api/process-table
Content-Type: application/json

{
  "query": "Analyze the sales data and create a summary table with totals"
}
```

#### 3. Apply Table to Spreadsheet
```bash
POST http://localhost:5001/api/apply-table
Content-Type: application/json

{
  "sheet_id": "sheet-123",
  "values_table": {
    "1": {"A": "Total", "B": 1000}
  },
  "formulas_table": {
    "2": {"A": "=SUM(B1:B10)"}
  }
}
```

#### 4. Get Available Tools
```bash
GET http://localhost:5001/api/tools
```

#### 5. Health Check
```bash
GET http://localhost:5001/api/health
```

### Example: Python Client

```python
import requests

# Chat with LLM
response = requests.post('http://localhost:5001/api/chat', json={
    "query": "Get the first sheet and show me the data in table format"
})

result = response.json()
print(result['response'])

# If LLM extracted a table
if result.get('extractedTable'):
    table = result['extractedTable']
    print("Values:", table.get('values_table'))
    print("Formulas:", table.get('formulas_table'))
```

### Example: Node.js Client

```javascript
const axios = require('axios');

async function chatWithLLM(query) {
  const response = await axios.post('http://localhost:5001/api/chat', {
    query: query
  });
  
  return response.data;
}

// Usage
chatWithLLM("Analyze the spreadsheet and create a summary")
  .then(result => {
    console.log(result.response);
    if (result.extractedTable) {
      console.log('Table:', result.extractedTable);
    }
  });
```

## How It Works

### 1. LLM Understanding

The LLM is taught about the table format through a system prompt:

```
values_table: {
  "1": {"A": "Name", "B": "Value"},
  "2": {"A": "Total", "B": 100}
}

formulas_table: {
  "3": {"A": "=SUM(B1:B2)"}
}
```

### 2. Function Calling

When you ask the LLM to:
- "Get the data from sheet 1" → Calls `get_excel_tables`
- "Add a total row" → Calls `set_from_table` with calculated data
- "Update cell A1" → Calls `set_cell`

### 3. Tool Execution

1. User sends query
2. LLM decides which tools to use
3. Tools execute API calls
4. Results sent back to LLM
5. LLM generates final response

### 4. Table Format

The LLM is trained to:
- **Read**: Understand `get_excel_tables` output format
- **Write**: Generate `set_from_table` input format
- **Process**: Analyze data and create new tables

## Tools Available

### 1. `get_all_sheets`
Get list of all sheets in workbook.

### 2. `get_excel_tables`
Get sheet data in Excel table format (values_table + formulas_table).

### 3. `set_from_table` ⭐ (Primary write method)
Apply data using table format. Matches the format from `get_excel_tables`.

### 4. `set_cell`
Set a single cell value or formula.

### 5. `set_cells`
Set multiple cells at once.

## Example Queries

### Read Data
```
"Get the data from the first sheet"
"Show me all the formulas in sheet 1"
"What's in cell A1 of the first sheet?"
```

### Write Data
```
"Add a total row at the bottom with sum of column B"
"Create a new table with sales data: Company A: 1000, Company B: 2000"
"Update cell C5 with the formula =SUM(A1:A10)"
```

### Analyze & Process
```
"Analyze the revenue data and create a summary table"
"Calculate percentages for each row in column C"
"Find the maximum value in column B and highlight it"
```

## Configuration

### Environment Variables

- `GEMINI_API_KEY` - Required. Your Google Gemini API key
- `API_URL` - Optional. Default: `http://localhost:5000`
- `LLM_PORT` - Optional. Default: `5001`

### Model Settings

In `gemini_service.js`, you can adjust:
- `temperature` - Creativity (0.0-1.0)
- `topK` - Token selection
- `topP` - Nucleus sampling
- `maxOutputTokens` - Max response length

## Troubleshooting

### "Gemini service not initialized"
- Set `GEMINI_API_KEY` environment variable
- Restart the LLM server

### "API client not connected"
- Make sure API server is running on port 5000
- Check `API_URL` environment variable

### "Tool execution failed"
- Check API server logs
- Verify sheet_id is correct
- Ensure spreadsheet has data

### "No function calls made"
- LLM might not understand the query
- Try rephrasing the request
- Check system prompt in `gemini_service.js`

## Testing

Keep `test_apis.py` for manual API testing:

```bash
cd ai
python test_apis.py
```

The LLM code does NOT import from `test_apis.py` - all essential functions are in `api_client.js`.

## Table Format

**How tables are sent to the LLM:**

When `get_excel_tables` is called, the LLM receives **both tables together** in the same JSON response:

```json
{
  "values_table": {
    "1": {"A": "Company", "B": "Revenue"},
    "2": {"A": "Acme", "B": 100000}
  },
  "formulas_table": {
    "1": {"A": "Company", "B": "Revenue"},
    "2": {"A": "Acme", "B": 100000},
    "3": {"A": "Total", "B": "=SUM(B2:B3)"}
  }
}
```

- **Both tables sent simultaneously** in the function result
- **Same structure**: Row numbers (strings "1", "2"...) → Column letters (A, B, C...) → Values
- **Row numbers are 1-based** (1, 2, 3...) matching Excel
- **Formulas start with "="** in formulas_table

See `TABLE_FORMAT.md` for detailed explanation.

## Next Steps

1. **Customize System Prompt** - Edit `gemini_service.js` to teach specific behaviors
2. **Add More Tools** - Extend `llm_tools.js` with new capabilities
3. **Fine-tune Responses** - Adjust model parameters in `gemini_service.js`
4. **Add Conversation Memory** - Implement history tracking
5. **Error Handling** - Improve error messages and recovery

## Security Notes

- Never commit API keys to git
- Use environment variables for secrets
- Consider rate limiting for production
- Validate all inputs before processing

