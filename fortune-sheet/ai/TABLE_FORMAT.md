# Table Format: How Data is Sent to LLM

## Overview

When the LLM calls the `get_excel_tables` tool, it receives spreadsheet data in a specific JSON format containing **two separate tables**: `values_table` and `formulas_table`.

## Format Structure

### 1. API Response Format

When `get_excel_tables` is called, the API returns:

```json
{
  "sheet_id": "abc123",
  "sheet_name": "Sheet1",
  "dimensions": {
    "rows": 10,
    "columns": 5,
    "column_headers": ["A", "B", "C", "D", "E"],
    "row_start": 1,
    "row_end": 10
  },
  "values_table": {
    "description": "Table showing actual cell values",
    "data": {
      "1": {"A": "Company", "B": "Revenue", "C": "Profit", "D": null, "E": null},
      "2": {"A": "Acme Corp", "B": 100000, "C": 20000, "D": null, "E": null},
      "3": {"A": "Beta Inc", "B": 150000, "C": 30000, "D": null, "E": null}
    },
    "array": [
      ["", "A", "B", "C", "D", "E"],
      [1, "Company", "Revenue", "Profit", null, null],
      [2, "Acme Corp", 100000, 20000, null, null],
      [3, "Beta Inc", 150000, 30000, null, null]
    ]
  },
  "formulas_table": {
    "description": "Table showing formulas where they exist",
    "data": {
      "1": {"A": "Company", "B": "Revenue", "C": "Profit", "D": null, "E": null},
      "2": {"A": "Acme Corp", "B": 100000, "C": 20000, "D": null, "E": null},
      "3": {"A": "Beta Inc", "B": 150000, "C": 30000, "D": null, "E": null},
      "4": {"A": "Total", "B": "=SUM(B2:B3)", "C": "=SUM(C2:C3)", "D": null, "E": null}
    },
    "array": [
      ["", "A", "B", "C", "D", "E"],
      [1, "Company", "Revenue", "Profit", null, null],
      [2, "Acme Corp", 100000, 20000, null, null],
      [3, "Beta Inc", 150000, 30000, null, null],
      [4, "Total", "=SUM(B2:B3)", "=SUM(C2:C3)", null, null]
    ]
  },
  "formula_cells": [
    {
      "cell": "B4",
      "row": 4,
      "col": "B",
      "formula": "=SUM(B2:B3)",
      "value": 250000
    },
    {
      "cell": "C4",
      "row": 4,
      "col": "C",
      "formula": "=SUM(C2:C3)",
      "value": 50000
    }
  ]
}
```

### 2. How LLM Receives It

When the tool executes, the **entire response object** is sent to the LLM as the function result:

```javascript
// In gemini_service.js, line 149-155
const toolResult = await this.tools.executeTool(toolName, args);
functionResults.push({
  functionResponse: {
    name: toolName,  // e.g., "get_excel_tables"
    response: toolResult  // <-- The entire API response goes here
  }
});
```

So the LLM receives:
```json
{
  "name": "get_excel_tables",
  "response": {
    "sheet_id": "abc123",
    "values_table": { ... },
    "formulas_table": { ... },
    "formula_cells": [ ... ]
  }
}
```

### 3. What the LLM Sees

The LLM receives **both tables simultaneously** in the same JSON object:

- **`values_table`**: Shows actual cell values (what users see)
- **`formulas_table`**: Shows formulas where they exist, otherwise shows values

**Key Points:**
- Both tables use the **same structure**: row numbers (as strings "1", "2", etc.) → column letters (A, B, C, etc.) → cell values
- Row numbers are **1-based** (1, 2, 3...) matching Excel
- Column letters are **A, B, C...** matching Excel
- Formulas in `formulas_table` start with `"="`
- `null` represents empty cells

### 4. LLM Output Format

When the LLM needs to **write data back**, it uses the same format:

```json
{
  "values_table": {
    "1": {"A": "New Data", "B": 100},
    "2": {"A": "More Data", "B": 200}
  },
  "formulas_table": {
    "3": {"A": "Total", "B": "=SUM(B1:B2)"}
  }
}
```

This format is sent to `set_from_table` tool.

## Data Flow Diagram

```
1. User asks: "Get data from sheet 1"
   ↓
2. LLM calls: get_excel_tables(sheet_id="abc123")
   ↓
3. API returns: { values_table: {...}, formulas_table: {...} }
   ↓
4. Tool result sent to LLM:
   {
     name: "get_excel_tables",
     response: {
       values_table: {...},    ← Both tables sent together
       formulas_table: {...}    ← in the same JSON object
     }
   }
   ↓
5. LLM processes both tables and generates response
   ↓
6. User sees: LLM's analysis + API call details + table preview
```

## Example: Complete Flow

### Step 1: User Query
```
"Get the data from the first sheet and show me the revenue column"
```

### Step 2: LLM Calls Tool
```javascript
get_excel_tables({
  sheet_id: "sheet-123"
})
```

### Step 3: API Response (sent to LLM)
```json
{
  "values_table": {
    "1": {"A": "Company", "B": "Revenue"},
    "2": {"A": "Acme", "B": 100000},
    "3": {"A": "Beta", "B": 150000}
  },
  "formulas_table": {
    "1": {"A": "Company", "B": "Revenue"},
    "2": {"A": "Acme", "B": 100000},
    "3": {"A": "Beta", "B": 150000},
    "4": {"A": "Total", "B": "=SUM(B2:B3)"}
  }
}
```

### Step 4: LLM Response
```
I found the revenue data in column B:
- Row 2: Acme - $100,000
- Row 3: Beta - $150,000
- Row 4: Total (formula) - $250,000
```

## Important Notes

1. **Both tables are sent together** - The LLM receives `values_table` and `formulas_table` in the same function result object
2. **Same structure** - Both use row numbers (strings) → column letters → values
3. **Formulas are visible** - The LLM can see which cells have formulas and what they calculate
4. **Empty cells are null** - The LLM knows which cells are empty
5. **Excel coordinates** - Everything uses A1, B2 style references (1-based rows, letter columns)

## In the HTML Chat Interface

The chat interface shows:
1. **API Call** - Which tool was called and with what parameters
2. **API Result** - The full JSON response (including both tables)
3. **Table Preview** - Formatted display of `values_table` and `formulas_table` if present
4. **LLM Response** - The LLM's analysis and answer

This gives you full visibility into:
- What the LLM decided to do (API calls)
- What data it received (table format)
- How it interpreted the data (LLM response)

