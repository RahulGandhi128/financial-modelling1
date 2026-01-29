# LLM Tools Summary

## Total Tools: 6

### 1. **Reading Tools** (2 tools)

#### `get_all_sheets`
- **Purpose**: List all sheets in the workbook
- **Returns**: Array of sheet metadata (id, name, order)
- **Use case**: Discover available sheets (usually auto-loaded, so rarely needed)

#### `get_excel_tables` ⭐ **PRIMARY READING TOOL**
- **Purpose**: Read sheet data in Excel table format
- **Returns**: Two tables:
  - `values_table`: Shows actual cell values
  - `formulas_table`: Shows formulas where they exist, otherwise values
- **Format**: Excel coordinates (A1, B2, etc.), 1-based rows
- **Use case**: This is the main tool for reading spreadsheet data

---

### 2. **Writing Tools** (3 tools)

#### `set_from_table` ⭐ **PRIMARY WRITING TOOL**
- **Purpose**: Write data using the same table format as `get_excel_tables`
- **Input**: 
  - `values_table`: Object with row numbers as keys, column letters as nested keys
  - `formulas_table`: Same structure but with formulas (must start with "=")
- **Use case**: Primary method for writing data - matches the reading format exactly

#### `set_cell`
- **Purpose**: Set a single cell value or formula
- **Input**: `sheet_id`, `cell` (A1, B2, etc.), `value` or `formula`
- **Use case**: Quick single-cell updates

#### `set_cells`
- **Purpose**: Set multiple cells at once
- **Input**: `sheet_id`, `cells` (array of cell objects)
- **Use case**: Batch updates (more efficient than multiple `set_cell` calls)

---

### 3. **Sheet Management Tools** (1 tool)

#### `create_sheet` 🆕
- **Purpose**: Create a new sheet in the workbook
- **Input**: Optional `name` and `order`
- **Returns**: New sheet's ID and name
- **Use case**: Organize data across multiple sheets (e.g., separate sheets for assumptions, income statement, balance sheet)

---

## Tool Categories (Your Understanding)

You're thinking of it as **3 main categories**, which is correct:

1. **Data Reading** → `get_excel_tables` (returns both values_table and formulas_table)
2. **Data Writing** → `set_from_table` (primary), `set_cell`, `set_cells` (helpers)
3. **Sheet Management** → `create_sheet` (newly built)

Plus `get_all_sheets` as a utility tool (usually not needed since sheets are auto-loaded).

---

## Recommended Usage Pattern

For building financial models:

1. **Create sheets**: Use `create_sheet` to create separate sheets
   - "Assumptions"
   - "Income Statement"
   - "Balance Sheet"
   - "Cash Flow"

2. **Read data**: Use `get_excel_tables` to read existing data
   - Returns both values and formulas in one call

3. **Write data**: Use `set_from_table` to write data
   - Matches the format you receive from `get_excel_tables`
   - Can write both values and formulas in one call

---

## About LangGraph

**No, we haven't used LangGraph.** 

The current implementation uses a **custom agent loop** built directly with the Gemini Python SDK:

- **Custom Implementation**: Simple while loop that:
  1. Sends query to Gemini
  2. Checks for function calls
  3. Executes tools
  4. Sends results back
  5. Repeats until complete (max 10 iterations)

**Why not LangGraph?**
- Current approach is simpler for this use case
- Direct control over the flow
- No additional dependencies
- Works well for sequential tool calling

**When LangGraph would help:**
- Complex branching logic
- State management across sessions
- Error recovery workflows
- Dynamic tool selection based on context

For your current needs (read → process → write → create sheets), the custom loop is sufficient and easier to maintain.

