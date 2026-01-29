"""
MCP-style Tools for Gemini LLM
Defines tools that the LLM can use to interact with FortuneSheet
"""

from typing import Dict, List, Any, Optional
from api_client import FortuneSheetAPIClient


class LLMTools:
    """Tool registry and executor for LLM function calling"""
    
    def __init__(self, api_client: FortuneSheetAPIClient):
        """
        Initialize LLM tools
        
        Args:
            api_client: FortuneSheet API client instance
        """
        self.api_client = api_client
    
    def get_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        Get tool definitions in Gemini function calling format
        
        Returns:
            List of tool definitions
        """
        return [
            {
                "name": "get_all_sheets",
                "description": "Get list of all sheets in the workbook. Returns sheet metadata including id and name.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            {
                "name": "get_excel_tables",
                "description": "Get Excel-like tables (values and formulas) from a sheet. Returns data in the same format that you should output: values_table and formulas_table with Excel coordinates (A1, B2, etc.). Row numbers are 1-based, columns are A, B, C, etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sheet_id": {
                            "type": "string",
                            "description": "The ID of the sheet to get data from"
                        }
                    },
                    "required": ["sheet_id"]
                }
            },
            {
                "name": "set_from_table",
                "description": "Apply data to a sheet using the Excel table format. This is the primary method for writing data back to the spreadsheet. Accepts values_table and formulas_table in the same format as get_excel_tables output. Row numbers are 1-based (1, 2, 3...), columns are A, B, C, etc. Formulas should start with '='. Use null for empty cells.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sheet_id": {
                            "type": "string",
                            "description": "The ID of the sheet to update"
                        },
                        "values_table": {
                            "type": "object",
                            "description": "Object with row numbers (as strings '1', '2', etc.) as keys, and objects with column letters (A, B, C, etc.) as keys containing cell values. Example: {'1': {'A': 'Name', 'B': 'Value'}, '2': {'A': 'Total', 'B': 100}}"
                        },
                        "formulas_table": {
                            "type": "object",
                            "description": "Object with row numbers (as strings '1', '2', etc.) as keys, and objects with column letters (A, B, C, etc.) as keys containing formulas (must start with '='). Example: {'3': {'C': '=SUM(A1:A2)'}}"
                        }
                    },
                    "required": ["sheet_id"]
                }
            },
            {
                "name": "set_cell",
                "description": "Set a single cell value or formula. Use Excel coordinates like 'A1', 'B2', etc.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sheet_id": {
                            "type": "string",
                            "description": "The ID of the sheet to update"
                        },
                        "cell": {
                            "type": "string",
                            "description": "Excel cell reference (e.g., 'A1', 'B2')"
                        },
                        "value": {
                            "type": "string",
                            "description": "Cell value (text or number as string). Omit this parameter if setting a formula."
                        },
                        "formula": {
                            "type": "string",
                            "description": "Cell formula (must start with '='). Omit this parameter if setting a value."
                        }
                    },
                    "required": ["sheet_id", "cell"]
                }
            },
            {
                "name": "set_cells",
                "description": "Set multiple cells at once. More efficient than calling set_cell multiple times.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sheet_id": {
                            "type": "string",
                            "description": "The ID of the sheet to update"
                        },
                        "cells": {
                            "type": "array",
                            "description": "Array of cell objects. Each object should have: cell (Excel ref like 'A1'), value (string or number, optional), formula (string starting with '=', optional)",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "cell": {
                                        "type": "string",
                                        "description": "Excel cell reference (e.g., 'A1', 'B2')"
                                    },
                                    "value": {
                                        "type": "string",
                                        "description": "Cell value (text or number as string). Omit if setting a formula."
                                    },
                                    "formula": {
                                        "type": "string",
                                        "description": "Cell formula (must start with '='). Omit if setting a value."
                                    }
                                },
                                "required": ["cell"]
                            }
                        }
                    },
                    "required": ["sheet_id", "cells"]
                }
            },
            {
                "name": "create_sheet",
                "description": "Create a new sheet in the workbook. Returns the new sheet's ID and name. Use this when you need to create a new worksheet for organizing data (e.g., creating separate sheets for different financial statements, assumptions, etc.).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Name for the new sheet (e.g., 'Income Statement', 'Assumptions', 'Sheet2'). If not provided, a default name will be generated (Sheet1, Sheet2, etc.)."
                        },
                        "order": {
                            "type": "integer",
                            "description": "Position/order of the sheet in the workbook (0-based). If not provided, the sheet will be added at the end."
                        }
                    },
                    "required": []
                }
            },
            {
                "name": "get_all_sheets_excel_tables",
                "description": "Get Excel table format (values_table and formulas_table) for ALL sheets at once. Use this for final verification after creating a financial model to check all sheets were populated correctly. Returns data in the same format as get_excel_tables but for all sheets simultaneously.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }
        ]
    
    def execute_tool(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a tool call
        
        Args:
            tool_name: Name of the tool to execute
            args: Tool arguments
            
        Returns:
            Tool execution result
        """
        try:
            if tool_name == "get_all_sheets":
                return self.api_client.getAllSheets()
            
            elif tool_name == "get_excel_tables":
                if not args.get("sheet_id"):
                    raise ValueError("sheet_id is required")
                return self.api_client.getExcelTables(args["sheet_id"])
            
            elif tool_name == "set_from_table":
                if not args.get("sheet_id"):
                    raise ValueError("sheet_id is required")
                return self.api_client.setFromTable(
                    args["sheet_id"],
                    args.get("values_table"),
                    args.get("formulas_table")
                )
            
            elif tool_name == "set_cell":
                if not args.get("sheet_id") or not args.get("cell"):
                    raise ValueError("sheet_id and cell are required")
                return self.api_client.setCell(
                    args["sheet_id"],
                    args["cell"],
                    args.get("value"),
                    args.get("formula")
                )
            
            elif tool_name == "set_cells":
                if not args.get("sheet_id") or not args.get("cells"):
                    raise ValueError("sheet_id and cells are required")
                return self.api_client.setCells(args["sheet_id"], args["cells"])
            
            elif tool_name == "create_sheet":
                return self.api_client.createSheet(
                    args.get("name"),
                    args.get("order")
                )
            
            elif tool_name == "get_all_sheets_excel_tables":
                return self.api_client.getAllSheetsExcelTables()
            
            else:
                raise ValueError(f"Unknown tool: {tool_name}")
        
        except Exception as error:
            error_details = str(error)
            if hasattr(error, 'response') and hasattr(error.response, 'data'):
                error_details = error.response.data
            return {
                "error": True,
                "message": str(error),
                "details": error_details
            }

