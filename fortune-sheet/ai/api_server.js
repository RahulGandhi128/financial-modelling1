/**
 * AI Service API Server
 * Connects to FortuneSheet application and provides APIs for AI processing
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
// FortuneSheet workbook updates can get large; bump JSON limit to avoid PayloadTooLargeError
app.use(express.json({ limit: process.env.JSON_LIMIT || "25mb" }));

// Store workbook data (in production, connect to database or FortuneSheet backend)
let workbookData = [];

/**
 * Update workbook data from FortuneSheet app
 * This endpoint is called by the FortuneSheet app when data changes
 */
app.post("/api/workbook/update", (req, res) => {
  workbookData = req.body;
  console.log("Workbook data updated:", workbookData.length, "sheets");
  res.json({ success: true, sheets: workbookData.length });
});

/**
 * Get all sheets
 */
app.get("/api/sheets", (req, res) => {
  res.json(workbookData.map((sheet) => ({
    id: sheet.id,
    name: sheet.name,
    order: sheet.order,
  })));
});

/**
 * Convert column index to Excel-style column letter (A, B, C, ..., Z, AA, AB, ...)
 */
function indexToColumnChar(index) {
  let result = '';
  while (index >= 0) {
    result = String.fromCharCode(65 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  }
  return result;
}

/**
 * Convert Excel column letter to index (A=0, B=1, ..., Z=25, AA=26, etc.)
 */
function columnCharToIndex(columnChar) {
  let index = 0;
  for (let i = 0; i < columnChar.length; i++) {
    index = index * 26 + (columnChar.charCodeAt(i) - 64);
  }
  return index - 1;
}

/**
 * Parse Excel cell reference (A1, B2, etc.) to row and column indices
 * Returns {row: number, col: number} or null if invalid
 */
function parseCellReference(cellRef) {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return null;
  }
  const col = columnCharToIndex(match[1]);
  const row = parseInt(match[2], 10) - 1; // Convert to 0-based
  return { row, col };
}

/**
 * Convert row and column indices to Excel-style cell reference (A1, B2, etc.)
 */
function getCellReference(row, col) {
  return `${indexToColumnChar(col)}${row + 1}`;
}

// Store pending cell updates (queue for the app to apply)
const pendingUpdates = new Map(); // sheet_id -> array of updates


/**
 * Get Excel-like tables with values and formulas
 * Returns two tables:
 * 1. values_table: Shows actual cell values with Excel-style coordinates (A1, B2, etc.)
 * 2. formulas_table: Shows formulas where they exist, otherwise shows values
 */
app.get("/api/sheet/:id/excel-tables", (req, res) => {
  const sheet = workbookData.find((s) => s.id === req.params.id);
  if (!sheet) {
    return res.status(404).json({ error: "Sheet not found" });
  }
  
  // Find the bounds of the data
  let maxRow = 0;
  let maxCol = 0;
  const cellMap = new Map();
  
  if (sheet.data) {
    for (let r = 0; r < sheet.data.length; r++) {
      if (!sheet.data[r]) continue;
      for (let c = 0; c < sheet.data[r].length; c++) {
        const cell = sheet.data[r][c];
        if (cell != null) {
          maxRow = Math.max(maxRow, r);
          maxCol = Math.max(maxCol, c);
          cellMap.set(`${r},${c}`, cell);
        }
      }
    }
  }
  
  // Build column headers (A, B, C, ...)
  const columnHeaders = [];
  for (let c = 0; c <= maxCol; c++) {
    columnHeaders.push(indexToColumnChar(c));
  }
  
  // Build values table and formulas table
  const valuesTable = {};
  const formulasTable = {};
  
  for (let r = 0; r <= maxRow; r++) {
    const rowNum = r + 1; // Excel-style row number (1-based)
    valuesTable[rowNum] = {};
    formulasTable[rowNum] = {};
    
    for (let c = 0; c <= maxCol; c++) {
      const colLetter = indexToColumnChar(c);
      const key = `${r},${c}`;
      const cell = cellMap.get(key);
      
      if (cell) {
        // Get the display value (prefer 'm' for formatted, fallback to 'v')
        const value = cell.m !== undefined ? cell.m : (cell.v !== undefined ? cell.v : null);
        const formula = cell.f || null;
        
        // Values table always shows the value
        valuesTable[rowNum][colLetter] = value;
        
        // Formulas table shows formula if exists, otherwise value
        formulasTable[rowNum][colLetter] = formula || value;
      } else {
        valuesTable[rowNum][colLetter] = null;
        formulasTable[rowNum][colLetter] = null;
      }
    }
  }
  
  // Also build array format for easier display
  const valuesArray = [];
  const formulasArray = [];
  
  // Header row with column letters
  valuesArray.push(["", ...columnHeaders]);
  formulasArray.push(["", ...columnHeaders]);
  
  for (let r = 0; r <= maxRow; r++) {
    const rowNum = r + 1;
    const valuesRow = [rowNum]; // Start with row number
    const formulasRow = [rowNum];
    
    for (let c = 0; c <= maxCol; c++) {
      const colLetter = indexToColumnChar(c);
      valuesRow.push(valuesTable[rowNum][colLetter]);
      formulasRow.push(formulasTable[rowNum][colLetter]);
    }
    
    valuesArray.push(valuesRow);
    formulasArray.push(formulasRow);
  }
  
  res.json({
    sheet_id: sheet.id,
    sheet_name: sheet.name,
    dimensions: {
      rows: maxRow + 1,
      columns: maxCol + 1,
      column_headers: columnHeaders,
      row_start: 1,
      row_end: maxRow + 1,
    },
    values_table: {
      description: "Table showing actual cell values with Excel-style coordinates",
      data: valuesTable,
      array: valuesArray,
    },
    formulas_table: {
      description: "Table showing formulas where they exist, otherwise values",
      data: formulasTable,
      array: formulasArray,
    },
    formula_cells: (() => {
      const cells = [];
      for (let r = 0; r <= maxRow; r++) {
        for (let c = 0; c <= maxCol; c++) {
          const cell = cellMap.get(`${r},${c}`);
          if (cell && cell.f) {
            cells.push({
              cell: getCellReference(r, c),
              row: r + 1,
              col: indexToColumnChar(c),
              formula: cell.f,
              value: cell.m !== undefined ? cell.m : cell.v,
            });
          }
        }
      }
      return cells;
    })(),
  });
});


/**
 * Set a single cell value
 * POST /api/sheet/:id/cell
 * Body: { cell: "A1", value: "Hello", formula: null }
 */
app.post("/api/sheet/:id/cell", (req, res) => {
  const sheet = workbookData.find((s) => s.id === req.params.id);
  if (!sheet) {
    return res.status(404).json({ error: "Sheet not found" });
  }
  
  const { cell, value, formula } = req.body;
  if (!cell) {
    return res.status(400).json({ error: "Cell reference required (e.g., 'A1')" });
  }
  
  const coords = parseCellReference(cell);
  if (!coords) {
    return res.status(400).json({ error: "Invalid cell reference format" });
  }
  
  // Add to pending updates
  if (!pendingUpdates.has(req.params.id)) {
    pendingUpdates.set(req.params.id, []);
  }
  
  pendingUpdates.get(req.params.id).push({
    row: coords.row,
    col: coords.col,
    value: formula ? null : value,
    formula: formula || null,
    cell: cell,
  });
  
  res.json({
    success: true,
    message: "Cell update queued",
    cell: cell,
    row: coords.row,
    col: coords.col,
  });
});

/**
 * Set multiple cells at once
 * POST /api/sheet/:id/cells
 * Body: { cells: [{ cell: "A1", value: "Hello" }, { cell: "B1", formula: "=A1*2" }] }
 */
app.post("/api/sheet/:id/cells", (req, res) => {
  const sheet = workbookData.find((s) => s.id === req.params.id);
  if (!sheet) {
    return res.status(404).json({ error: "Sheet not found" });
  }
  
  const { cells } = req.body;
  if (!Array.isArray(cells)) {
    return res.status(400).json({ error: "Cells must be an array" });
  }
  
  if (!pendingUpdates.has(req.params.id)) {
    pendingUpdates.set(req.params.id, []);
  }
  
  const updates = [];
  for (const cellData of cells) {
    const { cell, value, formula } = cellData;
    if (!cell) continue;
    
    const coords = parseCellReference(cell);
    if (!coords) continue;
    
    updates.push({
      row: coords.row,
      col: coords.col,
      value: formula ? null : value,
      formula: formula || null,
      cell: cell,
    });
  }
  
  pendingUpdates.get(req.params.id).push(...updates);
  
  res.json({
    success: true,
    message: `${updates.length} cell updates queued`,
    count: updates.length,
  });
});

/**
 * Set cells from Excel table format (AI model output format)
 * POST /api/sheet/:id/from-table
 * Body: { values_table: { "1": {"A": "value"}, ... }, formulas_table: { "1": {"A": "=SUM(...)"}, ... } }
 */
app.post("/api/sheet/:id/from-table", (req, res) => {
  const sheet = workbookData.find((s) => s.id === req.params.id);
  if (!sheet) {
    return res.status(404).json({ error: "Sheet not found" });
  }
  
  const { values_table, formulas_table } = req.body;
  
  if (!values_table && !formulas_table) {
    return res.status(400).json({ error: "Either values_table or formulas_table required" });
  }
  
  if (!pendingUpdates.has(req.params.id)) {
    pendingUpdates.set(req.params.id, []);
  }
  
  const updates = [];
  const processedCells = new Set();
  
  // Process values table
  if (values_table) {
    for (const [rowNum, cols] of Object.entries(values_table)) {
      // Strip quotes from row number if present (e.g., "'39'" -> "39")
      const cleanRowNum = rowNum.replace(/^['"]+|['"]+$/g, '');
      const row = parseInt(cleanRowNum, 10) - 1; // Convert to 0-based
      if (isNaN(row) || row < 0) continue;
      
      for (const [colLetter, value] of Object.entries(cols)) {
        if (value === null || value === undefined) continue;
        
        const col = columnCharToIndex(colLetter);
        if (isNaN(col) || col < 0) continue;
        
        const cellKey = `${row},${col}`;
        if (!processedCells.has(cellKey)) {
          updates.push({
            row: row,
            col: col,
            value: value,
            formula: null,
            cell: getCellReference(row, col),
          });
          processedCells.add(cellKey);
        }
      }
    }
  }
  
  // Process formulas table (overrides values if same cell)
  if (formulas_table) {
    for (const [rowNum, cols] of Object.entries(formulas_table)) {
      // Strip quotes from row number if present (e.g., "'39'" -> "39")
      const cleanRowNum = rowNum.replace(/^['"]+|['"]+$/g, '');
      const row = parseInt(cleanRowNum, 10) - 1; // Convert to 0-based
      if (isNaN(row) || row < 0) continue;
      
      for (const [colLetter, formulaOrValue] of Object.entries(cols)) {
        if (formulaOrValue === null || formulaOrValue === undefined) continue;
        
        const col = columnCharToIndex(colLetter);
        if (isNaN(col) || col < 0) continue;
        
        const cellKey = `${row},${col}`;
        const isFormula = typeof formulaOrValue === 'string' && formulaOrValue.startsWith('=');
        
        // Remove existing update for this cell if any
        const existingIndex = updates.findIndex(u => u.row === row && u.col === col);
        if (existingIndex >= 0) {
          updates.splice(existingIndex, 1);
        }
        
        updates.push({
          row: row,
          col: col,
          value: isFormula ? null : formulaOrValue,
          formula: isFormula ? formulaOrValue : null,
          cell: getCellReference(row, col),
        });
      }
    }
  }
  
  pendingUpdates.get(req.params.id).push(...updates);
  
  res.json({
    success: true,
    message: `${updates.length} cell updates queued from table format`,
    count: updates.length,
    cells: updates.map(u => u.cell),
  });
});

/**
 * Get pending updates for a sheet (called by the app to apply changes)
 * GET /api/sheet/:id/pending-updates
 */
app.get("/api/sheet/:id/pending-updates", (req, res) => {
  const updates = pendingUpdates.get(req.params.id) || [];
  res.json({
    sheet_id: req.params.id,
    updates: updates,
    count: updates.length,
  });
});

/**
 * Clear pending updates after they've been applied
 * DELETE /api/sheet/:id/pending-updates
 */
app.delete("/api/sheet/:id/pending-updates", (req, res) => {
  pendingUpdates.delete(req.params.id);
  res.json({
    success: true,
    message: "Pending updates cleared",
  });
});

/**
 * Health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    sheets: workbookData.length,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`AI Service API Server running on http://localhost:${PORT}`);
  console.log(`Ready to receive data from FortuneSheet application`);
});

