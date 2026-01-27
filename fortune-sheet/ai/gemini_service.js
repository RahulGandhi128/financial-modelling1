/**
 * Gemini 2.5 Flash Service
 * Integrates Google Gemini 2.5 Flash with FortuneSheet
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const LLMTools = require('./llm_tools');

class GeminiService {
  constructor(apiKey, apiClient) {
    if (!apiKey) {
      throw new Error('Gemini API key is required. Set GEMINI_API_KEY environment variable.');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.apiClient = apiClient;
    this.tools = new LLMTools(apiClient);
    this.toolDefinitions = this.createToolDefinitions();
    
    // Initialize model with tools
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp'
    });
  }

  /**
   * Create tool definitions for Gemini
   */
  createToolDefinitions() {
    const llmTools = new LLMTools(this.apiClient);
    const toolDefs = llmTools.getToolDefinitions();
    
    // Convert to Gemini function calling format
    return toolDefs.map(tool => ({
      functionDeclarations: [{
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }]
    }));
  }

  /**
   * Get system prompt that teaches the LLM about the output format
   * @param {Array} sheetsInfo - Optional array of sheet information to include
   */
  getSystemPrompt(sheetsInfo = null) {
    let sheetsContext = '';
    if (sheetsInfo && sheetsInfo.length > 0) {
      sheetsContext = `\n\nCURRENT WORKBOOK SHEETS (automatically loaded - no need to call get_all_sheets):
${sheetsInfo.map((s, i) => `  ${i + 1}. Sheet "${s.name}" (ID: ${s.id})`).join('\n')}

When users refer to "sheet 1", "first sheet", or "initial sheet", they mean: ${sheetsInfo[0].name} (ID: ${sheetsInfo[0].id})
You can directly use sheet ID "${sheetsInfo[0].id}" without calling get_all_sheets first.`;
    } else {
      sheetsContext = '\n\nNote: Use get_all_sheets tool to discover available sheets if needed.';
    }
    
    return `You are an AI assistant that helps users work with Excel spreadsheets through FortuneSheet.
${sheetsContext}

CRITICAL OUTPUT FORMAT:
When you need to output or modify spreadsheet data, you MUST use this exact format:

1. **values_table**: An object where:
   - Keys are row numbers as strings ("1", "2", "3", etc.) - these are 1-based (row 1, row 2, etc.)
   - Values are objects where:
     - Keys are column letters ("A", "B", "C", etc.)
     - Values are the actual cell values (strings, numbers, or null for empty cells)

2. **formulas_table**: An object with the same structure, but:
   - Contains formulas (must start with "=") where they exist
   - Contains values where no formula exists
   - Use null for empty cells

EXAMPLE OUTPUT FORMAT:
{
  "values_table": {
    "1": {"A": "Company Name", "B": "Revenue", "C": "Profit"},
    "2": {"A": "Acme Corp", "B": 100000, "C": 20000},
    "3": {"A": "Beta Inc", "B": 150000, "C": 30000}
  },
  "formulas_table": {
    "4": {"A": "Total", "B": "=SUM(B2:B3)", "C": "=SUM(C2:C3)"}
  }
}

IMPORTANT RULES:
- Row numbers are 1-based (1, 2, 3...) matching Excel
- Column letters are A, B, C, ... Z, AA, AB, etc.
- Formulas MUST start with "="
- Use null for empty cells
- When you receive data from get_excel_tables, it will be in this format
- When you send data via set_from_table, use this exact format

TOOLS AVAILABLE:
- get_all_sheets: Get list of all sheets
- get_excel_tables: Get current sheet data in the format above
- set_from_table: Apply data using the format above (PRIMARY METHOD for writing data)
- set_cell: Set a single cell
- set_cells: Set multiple cells

Always use set_from_table when you need to write data, as it matches the format you'll receive from get_excel_tables.`;
  }

  /**
   * Process a user query with tool calling
   */
  async processQuery(userQuery, conversationHistory = []) {
    try {
      // Build conversation history
      const history = [];
      
      // Get sheets info for context (saves API calls)
      let sheetsInfo = null;
      try {
        sheetsInfo = await this.apiClient.getAllSheets();
      } catch (e) {
        console.warn('Could not fetch sheets for context:', e.message);
      }
      
      // Add system prompt as first message with sheet info
      history.push({
        role: 'user',
        parts: [{ text: this.getSystemPrompt(sheetsInfo) }]
      });
      
      history.push({
        role: 'model',
        parts: [{ text: 'I understand. I will use the Excel table format (values_table and formulas_table) when reading and writing spreadsheet data. I have access to tools to interact with FortuneSheet.' }]
      });

      // Add conversation history
      for (const msg of conversationHistory) {
        history.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }

      // Start chat session with tools
      const chat = this.model.startChat({
        history: history,
        tools: this.toolDefinitions,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      });

      // Send query
      const result = await chat.sendMessage(userQuery);
      const response = await result.response;

      // Check if function calls were made
      const functionCalls = response.functionCalls();
      
      if (functionCalls && functionCalls.length > 0) {
        // Execute function calls
        const functionResults = [];
        
        for (const call of functionCalls) {
          const toolName = call.name;
          const args = call.args;
          
          console.log(`🔧 Executing tool: ${toolName}`, JSON.stringify(args, null, 2));
          
          const toolResult = await this.tools.executeTool(toolName, args);
          // Format function response for Gemini API
          // Note: Gemini expects the response as a structured object
          // If there's an error, wrap it properly
          const responseData = toolResult.error 
            ? { error: true, message: toolResult.message }
            : toolResult;
            
          functionResults.push({
            functionResponse: {
              name: toolName,
              response: responseData
            }
          });
        }

        // Send function results back to model
        const followUpResult = await chat.sendMessage(functionResults);
        const followUpResponse = await followUpResult.response;
        
        return {
          text: followUpResponse.text(),
          functionCalls: functionCalls.map(call => ({
            name: call.name,
            args: call.args
          })),
          functionResults: functionResults.map(fr => fr.functionResponse)
        };
      } else {
        // No function calls, just return text response
        return {
          text: response.text(),
          functionCalls: [],
          functionResults: []
        };
      }
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  /**
   * Process a query that expects table format output
   */
  async processTableQuery(userQuery, conversationHistory = []) {
    const response = await this.processQuery(userQuery, conversationHistory);
    
    // Try to extract JSON from response if LLM outputs it
    const text = response.text();
    const jsonMatch = text.match(/\{[\s\S]*"values_table"[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          ...response,
          extractedTable: parsed
        };
      } catch (e) {
        // JSON parsing failed, return text response
      }
    }
    
    return response;
  }
}

module.exports = GeminiService;

