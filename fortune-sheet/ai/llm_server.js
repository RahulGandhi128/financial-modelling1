/**
 * LLM Server - Main entry point for Gemini LLM integration
 * Provides HTTP API for interacting with Gemini 2.5 Flash
 */

// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const FortuneSheetAPIClient = require('./api_client');
const GeminiService = require('./gemini_service');

const app = express();
const PORT = process.env.LLM_PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize API client and Gemini service
let apiClient;
let geminiService;

function initializeServices() {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:5000';
    apiClient = new FortuneSheetAPIClient(apiUrl);
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  GEMINI_API_KEY not set. LLM features will not work.');
      console.warn('   Set GEMINI_API_KEY environment variable to enable Gemini.');
      return false;
    }
    
    geminiService = new GeminiService(apiKey, apiClient);
    console.log('✅ Gemini 2.5 Flash initialized');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Gemini service:', error.message);
    return false;
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    gemini_initialized: !!geminiService,
    api_connected: apiClient ? 'checking...' : false,
    timestamp: new Date().toISOString()
  });
});

// Get framework explanation
app.get('/api/explain', async (req, res) => {
  try {
    const sheets = await apiClient.getAllSheets();
    res.json({
      framework: 'FortuneSheet AI Framework',
      description: 'LLM-powered spreadsheet assistant with automatic sheet discovery',
      features: [
        'Automatic sheet discovery - LLM knows about sheets without extra API calls',
        'Function calling - LLM can read/write spreadsheet data',
        'Table format - Data sent in Excel-like format (values_table + formulas_table)',
        'Real-time sync - Changes appear in spreadsheet automatically'
      ],
      sheets: sheets,
      tools: [
        'get_all_sheets - List all sheets (usually not needed - sheets auto-loaded)',
        'get_excel_tables - Get sheet data in table format',
        'set_from_table - Write data using table format',
        'set_cell - Set single cell',
        'set_cells - Set multiple cells'
      ],
      howItWorks: {
        step1: 'LLM automatically receives sheet information on startup',
        step2: 'User asks question (e.g., "read sheet 1")',
        step3: 'LLM uses known sheet IDs to call get_excel_tables directly',
        step4: 'LLM receives data in values_table + formulas_table format',
        step5: 'LLM can analyze and write data back using set_from_table',
        step6: 'Changes are queued and applied to spreadsheet automatically'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoint - process user query with Gemini
app.post('/api/chat', async (req, res) => {
  if (!geminiService) {
    return res.status(503).json({
      error: 'Gemini service not initialized',
      message: 'Set GEMINI_API_KEY environment variable'
    });
  }

  try {
    const { query, history = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    console.log(`📝 Processing query: ${query.substring(0, 100)}...`);
    
    const response = await geminiService.processQuery(query, history);
    
    res.json({
      success: true,
      response: response.text,
      functionCalls: response.functionCalls,
      functionResults: response.functionResults,
      extractedTable: response.extractedTable || null
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({
      error: 'Failed to process query',
      message: error.message
    });
  }
});

// Process table query - expects table format output
app.post('/api/process-table', async (req, res) => {
  if (!geminiService) {
    return res.status(503).json({
      error: 'Gemini service not initialized',
      message: 'Set GEMINI_API_KEY environment variable'
    });
  }

  try {
    const { query, history = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    console.log(`📊 Processing table query: ${query.substring(0, 100)}...`);
    
    const response = await geminiService.processTableQuery(query, history);
    
    res.json({
      success: true,
      response: response.text,
      functionCalls: response.functionCalls,
      functionResults: response.functionResults,
      extractedTable: response.extractedTable || null
    });
  } catch (error) {
    console.error('Error processing table query:', error);
    res.status(500).json({
      error: 'Failed to process table query',
      message: error.message
    });
  }
});

// Apply AI-generated table to spreadsheet
app.post('/api/apply-table', async (req, res) => {
  if (!apiClient) {
    return res.status(503).json({
      error: 'API client not initialized'
    });
  }

  try {
    const { sheet_id, values_table, formulas_table } = req.body;
    
    if (!sheet_id) {
      return res.status(400).json({ error: 'sheet_id is required' });
    }

    if (!values_table && !formulas_table) {
      return res.status(400).json({ 
        error: 'Either values_table or formulas_table is required' 
      });
    }

    console.log(`📝 Applying table to sheet ${sheet_id}...`);
    
    const result = await apiClient.setFromTable(sheet_id, values_table, formulas_table);
    
    res.json({
      success: true,
      message: `Applied ${result.count} cells to spreadsheet`,
      result: result
    });
  } catch (error) {
    console.error('Error applying table:', error);
    res.status(500).json({
      error: 'Failed to apply table',
      message: error.message
    });
  }
});

// Get available tools
app.get('/api/tools', (req, res) => {
  if (!geminiService) {
    return res.status(503).json({
      error: 'Gemini service not initialized'
    });
  }

  const tools = geminiService.tools.getToolDefinitions();
  res.json({
    tools: tools,
    count: tools.length
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 LLM Server running on http://localhost:${PORT}`);
  console.log(`📋 API endpoints:`);
  console.log(`   POST /api/chat - Chat with Gemini`);
  console.log(`   POST /api/process-table - Process query expecting table output`);
  console.log(`   POST /api/apply-table - Apply table data to spreadsheet`);
  console.log(`   GET  /api/tools - List available tools`);
  console.log(`   GET  /api/health - Health check\n`);
  
  const initialized = initializeServices();
  if (initialized) {
    console.log('✅ Ready to process queries!\n');
  } else {
    console.log('⚠️  Set GEMINI_API_KEY to enable LLM features\n');
  }
});

module.exports = app;

