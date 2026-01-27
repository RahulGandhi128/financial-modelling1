/**
 * MCP-style Tools for Gemini LLM
 * Defines tools that the LLM can use to interact with FortuneSheet
 */

const FortuneSheetAPIClient = require('./api_client');

class LLMTools {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Get tool definitions in Gemini function calling format
   */
  getToolDefinitions() {
    return [
      {
        name: 'get_all_sheets',
        description: 'Get list of all sheets in the workbook. Returns sheet metadata including id and name.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_excel_tables',
        description: 'Get Excel-like tables (values and formulas) from a sheet. Returns data in the same format that you should output: values_table and formulas_table with Excel coordinates (A1, B2, etc.). Row numbers are 1-based, columns are A, B, C, etc.',
        parameters: {
          type: 'object',
          properties: {
            sheet_id: {
              type: 'string',
              description: 'The ID of the sheet to get data from'
            }
          },
          required: ['sheet_id']
        }
      },
      {
        name: 'set_from_table',
        description: 'Apply data to a sheet using the Excel table format. This is the primary method for writing data back to the spreadsheet. Accepts values_table and formulas_table in the same format as get_excel_tables output. Row numbers are 1-based (1, 2, 3...), columns are A, B, C, etc. Formulas should start with "=". Use null for empty cells.',
        parameters: {
          type: 'object',
          properties: {
            sheet_id: {
              type: 'string',
              description: 'The ID of the sheet to update'
            },
            values_table: {
              type: 'object',
              description: 'Object with row numbers (as strings "1", "2", etc.) as keys, and objects with column letters (A, B, C, etc.) as keys containing cell values. Example: {"1": {"A": "Name", "B": "Value"}, "2": {"A": "Total", "B": 100}}'
            },
            formulas_table: {
              type: 'object',
              description: 'Object with row numbers (as strings "1", "2", etc.) as keys, and objects with column letters (A, B, C, etc.) as keys containing formulas (must start with "="). Example: {"3": {"C": "=SUM(A1:A2)"}}'
            }
          },
          required: ['sheet_id']
        }
      },
      {
        name: 'set_cell',
        description: 'Set a single cell value or formula. Use Excel coordinates like "A1", "B2", etc.',
        parameters: {
          type: 'object',
          properties: {
            sheet_id: {
              type: 'string',
              description: 'The ID of the sheet to update'
            },
            cell: {
              type: 'string',
              description: 'Excel cell reference (e.g., "A1", "B2")'
            },
            value: {
              type: 'string',
              description: 'Cell value (text or number as string). Omit this parameter if setting a formula.'
            },
            formula: {
              type: 'string',
              description: 'Cell formula (must start with "="). Omit this parameter if setting a value.'
            }
          },
          required: ['sheet_id', 'cell']
        }
      },
      {
        name: 'set_cells',
        description: 'Set multiple cells at once. More efficient than calling set_cell multiple times.',
        parameters: {
          type: 'object',
          properties: {
            sheet_id: {
              type: 'string',
              description: 'The ID of the sheet to update'
            },
            cells: {
              type: 'array',
              description: 'Array of cell objects. Each object should have: cell (Excel ref like "A1"), value (string or number, optional), formula (string starting with "=", optional)',
              items: {
                type: 'object',
                properties: {
                  cell: { 
                    type: 'string',
                    description: 'Excel cell reference (e.g., "A1", "B2")'
                  },
                  value: { 
                    type: 'string',
                    description: 'Cell value (text or number as string). Omit if setting a formula.'
                  },
                  formula: { 
                    type: 'string',
                    description: 'Cell formula (must start with "="). Omit if setting a value.'
                  }
                },
                required: ['cell']
              }
            }
          },
          required: ['sheet_id', 'cells']
        }
      }
    ];
  }

  /**
   * Execute a tool call
   */
  async executeTool(toolName, args) {
    try {
      switch (toolName) {
        case 'get_all_sheets':
          return await this.apiClient.getAllSheets();

        case 'get_excel_tables':
          if (!args.sheet_id) {
            throw new Error('sheet_id is required');
          }
          return await this.apiClient.getExcelTables(args.sheet_id);

        case 'set_from_table':
          if (!args.sheet_id) {
            throw new Error('sheet_id is required');
          }
          return await this.apiClient.setFromTable(
            args.sheet_id,
            args.values_table || null,
            args.formulas_table || null
          );

        case 'set_cell':
          if (!args.sheet_id || !args.cell) {
            throw new Error('sheet_id and cell are required');
          }
          return await this.apiClient.setCell(
            args.sheet_id,
            args.cell,
            args.value || null,
            args.formula || null
          );

        case 'set_cells':
          if (!args.sheet_id || !args.cells) {
            throw new Error('sheet_id and cells are required');
          }
          return await this.apiClient.setCells(args.sheet_id, args.cells);

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      return {
        error: true,
        message: error.message,
        details: error.response?.data || error.toString()
      };
    }
  }
}

module.exports = LLMTools;

