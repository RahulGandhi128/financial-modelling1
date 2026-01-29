# Write APIs Documentation

## Overview
The AI service now supports **bidirectional communication** - your AI model can write data back to the FortuneSheet spreadsheet!

## How It Works

### Data Flow
```
AI Model (Python)
  ↓
POST /api/sheet/:id/from-table
  ↓
API Server stores updates in queue
  ↓
Browser client polls for updates (every 2 seconds)
  ↓
Applies updates to spreadsheet using workbookRef.setCellValue()
  ↓
Spreadsheet updates automatically!
```

## Available Write APIs

### 1. Create New Sheet
**Endpoint**: `POST /api/sheets`

**Request Body**:
```json
{
  "name": "Income Statement",
  "order": 1
}
```

**Parameters**:
- `name` (optional): Name for the new sheet. If not provided, a default name will be generated (Sheet1, Sheet2, etc.). If the name already exists, a number will be appended.
- `order` (optional): Position/order of the sheet in the workbook (0-based). If not provided, the sheet will be added at the end.

**Response**:
```json
{
  "success": true,
  "sheet": {
    "id": "sheet_1234567890_abc123",
    "name": "Income Statement",
    "order": 1
  },
  "message": "Sheet \"Income Statement\" created successfully"
}
```

**Python Example**:
```python
from api_client import FortuneSheetAPIClient

client = FortuneSheetAPIClient()
result = client.createSheet(name="Assumptions", order=0)
print(f"Created sheet: {result['sheet']['name']} (ID: {result['sheet']['id']})")
```

**Use Cases**:
- Creating separate sheets for different financial statements
- Organizing data into multiple worksheets
- Building multi-sheet financial models

### 2. Set Single Cell
**Endpoint**: `POST /api/sheet/:id/cell`

**Request Body**:
```json
{
  "cell": "A1",
  "value": "Hello World",
  "formula": null
}
```

**Or with formula**:
```json
{
  "cell": "B1",
  "value": null,
  "formula": "=A1*2"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cell update queued",
  "cell": "A1",
  "row": 0,
  "col": 0
}
```

---

### 2. Set Multiple Cells
**Endpoint**: `POST /api/sheet/:id/cells`

**Request Body**:
```json
{
  "cells": [
    {"cell": "A1", "value": "Name"},
    {"cell": "B1", "value": "Amount"},
    {"cell": "A2", "value": "Total"},
    {"cell": "B2", "formula": "=SUM(B3:B10)"}
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "4 cell updates queued",
  "count": 4
}
```

---

### 3. Set from Table Format ⭐ (Best for AI Models)
**Endpoint**: `POST /api/sheet/:id/from-table`

**Request Body** (matches the output format from `/api/sheet/:id/excel-tables`):
```json
{
  "values_table": {
    "1": {"A": "Om Freight Forwarders Ltd.", "B": null, "C": null, "D": null},
    "2": {"A": "No. of Equity Shares", "B": "Total Amount", "C": "% of Anchor", "D": "Bid price"},
    "3": {"A": "4,36,896", "B": "5,89,80,960", "C": null, "D": "135"},
    "4": {"A": "3,70,407", "B": "5,00,04,945", "C": null, "D": "135"}
  },
  "formulas_table": {
    "3": {"C": "=B3/$B$6"},
    "4": {"C": "=B4/$B$6"},
    "6": {"A": "=SUM(A3:A5)", "B": "=SUM(B3:B5)"}
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "12 cell updates queued from table format",
  "count": 12,
  "cells": ["A1", "A2", "B2", "C2", "D2", "A3", "B3", "D3", "A4", "B4", "D4", "C3", "C4", "A6", "B6"]
}
```

**Key Points**:
- Row numbers are **1-based** (1, 2, 3...) matching Excel
- Column letters are **A, B, C...** matching Excel
- `values_table` contains actual values
- `formulas_table` contains formulas (cells with formulas override values_table)
- `null` values are skipped

---

### 4. Get Pending Updates
**Endpoint**: `GET /api/sheet/:id/pending-updates`

**Response**:
```json
{
  "sheet_id": "abc123",
  "updates": [
    {"row": 0, "col": 0, "value": "Hello", "formula": null, "cell": "A1"},
    {"row": 0, "col": 1, "value": null, "formula": "=A1*2", "cell": "B1"}
  ],
  "count": 2
}
```

---

### 5. Clear Pending Updates
**Endpoint**: `DELETE /api/sheet/:id/pending-updates`

**Response**:
```json
{
  "success": true,
  "message": "Pending updates cleared"
}
```

---

## Python Client Usage

### Example: Your AI Model Output

```python
from test_apis import FortuneSheetAIClient

# Initialize client
client = FortuneSheetAIClient()

# Get sheet ID
sheets = client.get_all_sheets()
sheet_id = sheets[0]['id']

# Your AI model generates this output (same format as excel-tables output)
ai_output = {
    "values_table": {
        "1": {"A": "Om Freight Forwarders Ltd.", "B": None, "C": None, "D": None},
        "2": {"A": "No. of Equity Shares", "B": "Total Amount", "C": "% of Anchor", "D": "Bid price"},
        "3": {"A": "4,36,896", "B": "5,89,80,960", "C": None, "D": "135"},
        "4": {"A": "3,70,407", "B": "5,00,04,945", "C": None, "D": "135"},
        "5": {"A": "3,70,407", "B": "5,00,04,945", "C": None, "D": "135"},
        "6": {"A": None, "B": None, "C": "100.00%", "D": None},
    },
    "formulas_table": {
        "3": {"C": "=B3/$B$6"},
        "4": {"C": "=B4/$B$6"},
        "5": {"C": "=B5/$B$6"},
        "6": {"A": "=SUM(A3:A5)", "B": "=SUM(B3:B5)", "C": "=SUM(C3:C5)"},
    }
}

# Send to spreadsheet
result = client.set_from_table(
    sheet_id,
    values_table=ai_output["values_table"],
    formulas_table=ai_output["formulas_table"]
)

print(f"✅ {result['count']} cells queued for update")
print(f"Cells: {', '.join(result['cells'])}")
```

---

## Testing

### Run Test Script
```bash
cd ai
python test_apis.py
```

### Available Tests:
1. **Get Excel Tables** - See current spreadsheet data
2. **Set Single Cell** - Test setting one cell
3. **Set Multiple Cells** - Test setting multiple cells
4. **Set from Table Format** ⭐ - Test AI model output format (uses sample data)
5. **Get Pending Updates** - Check what's queued

### Sample Data in Test 4
The test includes sample data matching your output format:
- IPO data table with equity shares, amounts, percentages
- Formulas for calculating percentages and totals
- Same structure as the Excel tables output

---

## How Updates Are Applied

1. **AI Model sends data** → API server queues updates
2. **Browser client polls** every 2 seconds for pending updates
3. **When updates found** → Client applies them using `workbookRef.setCellValue()`
4. **Updates cleared** → Queue is cleared after successful application
5. **Spreadsheet updates** → Changes appear automatically!

---

## Coordinate System

### Excel Format → Internal Format
- **Excel**: A1, B2, C3 (1-based rows, letter columns)
- **Internal**: row=0, col=0 (0-based indices)

### Conversion
- `A1` → `{row: 0, col: 0}`
- `B2` → `{row: 1, col: 1}`
- `AA10` → `{row: 9, col: 26}`

The API handles all conversions automatically!

---

## Formula Support

Formulas are fully supported:
- Simple formulas: `=A1+B1`
- Functions: `=SUM(A1:A10)`
- Absolute references: `=$B$6`
- Cross-sheet references: `=Sheet2!A1` (if sheet exists)

---

## Error Handling

- Invalid cell references return `400 Bad Request`
- Sheet not found returns `404 Not Found`
- Updates are queued even if spreadsheet is temporarily unavailable
- Browser client retries automatically

---

## Best Practices for AI Models

1. **Use table format** (`/from-table`) - It matches your output format exactly
2. **Separate values and formulas** - Use `values_table` for data, `formulas_table` for calculations
3. **Use Excel coordinates** - A1, B2, etc. (not row/col indices)
4. **Handle nulls** - Omit cells with null values (they won't be set)
5. **Batch updates** - Send all changes in one request for better performance

---

## Example: Complete AI Model Integration

```python
# Your AI model processes data and generates output
def process_financial_data(raw_data):
    # ... your AI processing ...
    
    return {
        "values_table": {
            "1": {"A": "Revenue", "B": "Q1", "C": "Q2"},
            "2": {"A": "Sales", "B": 100000, "C": 120000},
        },
        "formulas_table": {
            "3": {"B": "=SUM(B2:B10)", "C": "=SUM(C2:C10)"}
        }
    }

# Send to spreadsheet
client = FortuneSheetAIClient()
sheets = client.get_all_sheets()
sheet_id = sheets[0]['id']

output = process_financial_data(data)
result = client.set_from_table(sheet_id, **output)

print(f"✅ Data written to spreadsheet: {result['count']} cells")
```

---

## Troubleshooting

### Updates not appearing?
1. Check browser console for errors
2. Verify AI service is running
3. Check pending updates: `GET /api/sheet/:id/pending-updates`
4. Ensure spreadsheet has data (at least one sheet exists)

### Formulas not calculating?
- Formulas are processed by FortuneSheet automatically
- Make sure referenced cells exist
- Check formula syntax (must start with `=`)

### Invalid cell reference?
- Use Excel format: A1, B2, etc.
- Row numbers must be positive integers
- Column letters must be A-Z or AA, AB, etc.

