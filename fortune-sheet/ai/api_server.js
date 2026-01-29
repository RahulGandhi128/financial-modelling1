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
 * Create a new sheet
 * POST /api/sheets
 * Body: { name?: string, order?: number }
 */
app.post("/api/sheets", (req, res) => {
  try {
    const { name, order } = req.body;
    
    // Generate unique sheet ID
    const sheetId = `sheet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine sheet name (default to "Sheet" + number)
    const existingNames = workbookData.map(s => s.name);
    let sheetName = name;
    if (!sheetName) {
      let sheetNum = workbookData.length + 1;
      sheetName = `Sheet${sheetNum}`;
      while (existingNames.includes(sheetName)) {
        sheetNum++;
        sheetName = `Sheet${sheetNum}`;
      }
    } else if (existingNames.includes(sheetName)) {
      // If name exists, append number
      let sheetNum = 1;
      let newName = `${sheetName}${sheetNum}`;
      while (existingNames.includes(newName)) {
        sheetNum++;
        newName = `${sheetName}${sheetNum}`;
      }
      sheetName = newName;
    }
    
    // Determine order (default to end)
    const sheetOrder = order !== undefined ? order : workbookData.length;
    
    // Create new sheet with default structure
    const newSheet = {
      id: sheetId,
      name: sheetName,
      order: sheetOrder,
      row: 84, // Default row count
      column: 60, // Default column count
      status: 0,
      config: {},
      celldata: [],
      data: [],
      scrollLeft: 0,
      scrollTop: 0,
      luckysheet_select_save: [],
      zoomRatio: 1,
      image: [],
      showGridLines: 1,
      frozen: {},
      chart: [],
      isPivotTable: false,
      pivotTable: null,
      filter_select: null,
      filter: null,
      luckysheet_conditionformat_save: [],
      luckysheet_alternateformat_save: [],
      hyperlink: {},
      luckysheet_alternateformat_save_model: [],
      dataVerification: {},
    };
    
    // Insert sheet at specified order
    if (order !== undefined && order < workbookData.length) {
      // Shift orders of existing sheets
      workbookData.forEach(sheet => {
        if (sheet.order >= order) {
          sheet.order = (sheet.order || 0) + 1;
        }
      });
      workbookData.splice(order, 0, newSheet);
    } else {
      workbookData.push(newSheet);
    }
    
    // Initialize pending updates for the new sheet
    pendingUpdates.set(sheetId, []);
    
    // Add to pending sheet creations queue for the app to apply
    pendingSheetCreations.push({
      id: sheetId,
      name: sheetName,
      order: sheetOrder,
      sheetData: newSheet
    });
    
    console.log(`New sheet created: ${sheetName} (ID: ${sheetId})`);
    console.log(`Pending sheet creations: ${pendingSheetCreations.length}`);
    
    res.json({
      success: true,
      sheet: {
        id: sheetId,
        name: sheetName,
        order: sheetOrder,
      },
      message: `Sheet "${sheetName}" created successfully`,
    });
  } catch (error) {
    console.error("Error creating sheet:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create sheet",
      message: error.message,
    });
  }
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

// Store pending sheet creations (queue for the app to apply)
const pendingSheetCreations = []; // array of { id, name, order, sheetData }


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
  
  // Log queue status
  const totalPending = pendingUpdates.get(req.params.id).length;
  console.log(`📥 Queued ${updates.length} updates for sheet ${req.params.id} (${sheet?.name || 'Unknown'})`);
  if (totalPending > 100) {
    console.warn(`⚠️  WARNING: Sheet ${req.params.id} has ${totalPending} pending updates (may be stuck)`);
  }
  
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
 * Get pending sheet creations (called by the app to apply new sheets)
 * GET /api/pending-sheet-creations
 */
app.get("/api/pending-sheet-creations", (req, res) => {
  res.json({
    sheets: pendingSheetCreations,
    count: pendingSheetCreations.length,
  });
});

/**
 * Clear pending sheet creations after they've been applied
 * DELETE /api/pending-sheet-creations
 */
app.delete("/api/pending-sheet-creations", (req, res) => {
  const count = pendingSheetCreations.length;
  pendingSheetCreations.length = 0; // Clear the array
  res.json({
    success: true,
    message: `Cleared ${count} pending sheet creations`,
    cleared: count,
  });
});

/**
 * Get all pending updates across all sheets (for monitoring/debugging)
 * GET /api/pending-updates/all
 */
app.get("/api/pending-updates/all", (req, res) => {
  const allPending = {};
  let totalUpdates = 0;
  
  for (const [sheetId, updates] of pendingUpdates.entries()) {
    const sheet = workbookData.find(s => s.id === sheetId);
    allPending[sheetId] = {
      sheet_name: sheet ? sheet.name : "Unknown",
      updates_count: updates.length,
      cells: updates.map(u => u.cell).slice(0, 50), // First 50 cells
      total_cells: updates.length
    };
    totalUpdates += updates.length;
  }
  
  res.json({
    total_sheets_with_pending: pendingUpdates.size,
    total_updates_queued: totalUpdates,
    sheets: allPending,
    timestamp: new Date().toISOString()
  });
});

/**
 * Get Excel tables for ALL sheets at once (for final review)
 * GET /api/sheets/excel-tables/all
 */
app.get("/api/sheets/excel-tables/all", (req, res) => {
  const allSheetsData = {};
  
  for (const sheet of workbookData) {
    try {
      // Reuse the logic from the single sheet endpoint
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
            const value = cell.m !== undefined ? cell.m : (cell.v !== undefined ? cell.v : null);
            const formula = cell.f || null;
            
            valuesTable[rowNum][colLetter] = value;
            formulasTable[rowNum][colLetter] = formula || value;
          } else {
            valuesTable[rowNum][colLetter] = null;
            formulasTable[rowNum][colLetter] = null;
          }
        }
      }
      
      allSheetsData[sheet.id] = {
        sheet_id: sheet.id,
        sheet_name: sheet.name,
        values_table: valuesTable,
        formulas_table: formulasTable,
        values_count: Object.keys(valuesTable).length,
        formulas_count: Object.keys(formulasTable).length
      };
    } catch (error) {
      allSheetsData[sheet.id] = {
        sheet_id: sheet.id,
        sheet_name: sheet.name,
        error: error.message
      };
    }
  }
  
  res.json({
    sheets: allSheetsData,
    total_sheets: workbookData.length,
    timestamp: new Date().toISOString()
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
  
  // Periodic queue status logging (every 10 seconds)
  setInterval(() => {
    let totalPending = 0;
    const sheetsWithPending = [];
    
    for (const [sheetId, updates] of pendingUpdates.entries()) {
      if (updates.length > 0) {
        const sheet = workbookData.find(s => s.id === sheetId);
        totalPending += updates.length;
        sheetsWithPending.push({
          name: sheet?.name || 'Unknown',
          id: sheetId,
          count: updates.length
        });
      }
    }
    
    if (totalPending > 0) {
      console.log(`📊 Queue Status: ${totalPending} updates pending across ${sheetsWithPending.length} sheet(s)`);
      if (sheetsWithPending.length > 0) {
        sheetsWithPending.forEach(s => {
          if (s.count > 50) {
            console.warn(`   ⚠️  ${s.name}: ${s.count} updates (may be stuck)`);
          } else {
            console.log(`   - ${s.name}: ${s.count} updates`);
          }
        });
      }
    }
  }, 10000); // Every 10 seconds
});

