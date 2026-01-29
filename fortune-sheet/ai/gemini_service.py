"""
Gemini 2.5 Flash Service
Integrates Google Gemini 2.5 Flash with FortuneSheet
Includes agent loop for multi-step tasks
"""

import os
import json
import google.generativeai as genai
from google.generativeai import types as genai_types
from typing import Dict, List, Any, Optional
from api_client import FortuneSheetAPIClient
from llm_tools import LLMTools


class GeminiService:
    """Gemini LLM service with function calling and agent loop"""
    
    def __init__(self, api_key: str, api_client: FortuneSheetAPIClient):
        """
        Initialize Gemini service
        
        Args:
            api_key: Google Gemini API key
            api_client: FortuneSheet API client instance
        """
        if not api_key:
            raise ValueError("Gemini API key is required. Set GEMINI_API_KEY environment variable.")
        
        genai.configure(api_key=api_key)
        self.api_client = api_client
        self.tools = LLMTools(api_client)
        self.tool_definitions = self._create_tool_definitions()
        
        # Initialize model with tools
        # Tools are passed when creating the model
        self.model = genai.GenerativeModel(
            model_name='gemini-2.5-flash',
            tools=self.tool_definitions
        )
    
    def _create_tool_definitions(self) -> List[Dict[str, Any]]:
        """
        Create tool definitions for Gemini
        
        Returns:
            List of tool definitions in Gemini format
        """
        tool_defs = self.tools.get_tool_definitions()
        
        # Convert to Gemini function calling format
        return [
            {
                "function_declarations": [{
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool["parameters"]
                }]
            }
            for tool in tool_defs
        ]
    
    def _convert_protobuf_to_dict(self, obj) -> dict:
        """
        Convert protobuf objects (like MapComposite) to Python dict
        
        Args:
            obj: Protobuf object or dict-like object
            
        Returns:
            Python dict with JSON-serializable values
        """
        if obj is None:
            return {}
        
        # If it's already a dict, convert values recursively
        if isinstance(obj, dict):
            return {k: self._convert_protobuf_value(v) for k, v in obj.items()}
        
        # If it has items() method (like MapComposite), iterate and convert
        if hasattr(obj, 'items'):
            try:
                result = {}
                for key, value in obj.items():
                    result[str(key)] = self._convert_protobuf_value(value)
                return result
            except (TypeError, AttributeError):
                pass
        
        # Try to convert to dict directly
        try:
            if hasattr(obj, '__iter__') and not isinstance(obj, (str, bytes)):
                return {str(k): self._convert_protobuf_value(v) for k, v in obj}
        except (TypeError, AttributeError):
            pass
        
        return {}
    
    def _convert_protobuf_value(self, value):
        """
        Convert a single protobuf value to JSON-serializable Python type
        
        Args:
            value: Protobuf value or Python value
            
        Returns:
            JSON-serializable Python value
        """
        # Handle None
        if value is None:
            return None
        
        # Handle basic types
        if isinstance(value, (str, int, float, bool)):
            return value
        
        # Handle dict-like objects
        if isinstance(value, dict):
            return {k: self._convert_protobuf_value(v) for k, v in value.items()}
        
        # Handle list-like objects
        if isinstance(value, (list, tuple)):
            return [self._convert_protobuf_value(item) for item in value]
        
        # Handle protobuf MapComposite and similar
        if hasattr(value, 'items'):
            try:
                return {str(k): self._convert_protobuf_value(v) for k, v in value.items()}
            except:
                pass
        
        # Try to convert to string as last resort
        try:
            return str(value)
        except:
            return None
    
    def _get_system_prompt(self, sheets_info: Optional[List[Dict[str, Any]]] = None) -> str:
        """
        Get system prompt that teaches the LLM about the output format
        
        Args:
            sheets_info: Optional array of sheet information to include
            
        Returns:
            System prompt string
        """
        if sheets_info and len(sheets_info) > 0:
            sheets_context = f"\n\nCURRENT WORKBOOK SHEETS (automatically loaded - no need to call get_all_sheets):\n"
            for i, sheet in enumerate(sheets_info):
                sheets_context += f"  {i + 1}. Sheet \"{sheet.get('name')}\" (ID: {sheet.get('id')})\n"
            sheets_context += f"\nWhen users refer to \"sheet 1\", \"first sheet\", or \"initial sheet\", they mean: {sheets_info[0].get('name')} (ID: {sheets_info[0].get('id')})\n"
            sheets_context += f"You can directly use sheet ID \"{sheets_info[0].get('id')}\" without calling get_all_sheets first."
        else:
            sheets_context = "\n\nNote: Use get_all_sheets tool to discover available sheets if needed."
        
        return f"""You are an AI assistant that helps users work with Excel spreadsheets through FortuneSheet.
{sheets_context}

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
{{
  "values_table": {{
    "1": {{"A": "Company Name", "B": "Revenue", "C": "Profit"}},
    "2": {{"A": "Acme Corp", "B": 100000, "C": 20000}},
    "3": {{"A": "Beta Inc", "B": 150000, "C": 30000}}
  }},
  "formulas_table": {{
    "4": {{"A": "Total", "B": "=SUM(B2:B3)", "C": "=SUM(C2:C3)"}}
  }}
}}

IMPORTANT RULES:
- Row numbers are 1-based (1, 2, 3...) matching Excel
- Column letters are A, B, C, ... Z, AA, AB, etc.
- Formulas MUST start with "="
- Use null for empty cells
- When you receive data from get_excel_tables, it will be in this format
- When you send data via set_from_table, use this exact format

HOW THE AGENT LOOP WORKS - CONTEXT AWARENESS:
You operate in an iterative agent loop where you maintain full context:

**Iteration 0**: You receive the user's query and see the complete task
**Iteration 1+**: You receive function results from previous iterations and decide next steps

Your conversation history includes:
- Original user query (you always know the goal)
- All function calls you've made (you know what you've done)
- All function results received (you see outcomes and can plan accordingly)
- Any text responses (you maintain conversation flow)

This means you have FULL CONTEXT at every iteration. Use this to:
- Track progress: "I've created 2 sheets, need to create 1 more"
- Plan next steps: "I've populated assumptions, now I can build Income Statement"
- Verify completion: "I've created all sheets and populated them, task is done"

CONCISE PLANNING GUIDE (Common to All Financial Models):
When building financial models, remember these universal principles:

**Table Structure** (applies to all sheets):
- Row 1: Headers (e.g., "Year 1", "Year 2", "Year 3")
- Column A: Labels/descriptions (e.g., "Revenue", "COGS", "Gross Profit")
- Columns B+: Data and formulas
- Use consistent structure across related sheets

**Linkages** (critical for multi-sheet models):
- Reference other sheets: ='SheetName'!A1
- Use sheet names in formulas: ='Assumptions'!B2
- Link statements: Income Statement → Balance Sheet → Cash Flow
- Maintain formula consistency across years/columns

**Important Points**:
- Assumptions sheet first (all inputs in one place)
- Build statements sequentially (Income → Balance → Cash Flow)
- Add balance checks (Assets = Liabilities + Equity)
- Verify formulas reference correct sheet names
- Use consistent row/column structure for easy linking

TOOLS AVAILABLE:
- get_all_sheets: Get list of all sheets
- get_excel_tables: Get current sheet data in the format above
- get_all_sheets_excel_tables: Get ALL sheets' data at once (use for final verification)
- set_from_table: Apply data using the format above (PRIMARY METHOD for writing data)
- set_cell: Set a single cell
- set_cells: Set multiple cells
- create_sheet: Create a new sheet in the workbook

WORKFLOW FOR COMPLEX TASKS:
**STEP 1: PLANNING (Think First)**
Before executing, think about:
- What sheets need to be created? (List them)
- What data goes in each sheet?
- What are the dependencies? (formulas linking sheets)
- What is the execution order? (assumptions first, then statements)

**STEP 2: EXECUTION (Act)**
Execute your plan step by step:
1. Create all required sheets using create_sheet
2. Populate each sheet with data using set_from_table
3. Add formulas and linkages between sheets
4. Verify completion

**STEP 3: VERIFICATION (Check)**
After completing, use get_all_sheets_excel_tables to verify all sheets were created and populated.

Use multiple set_from_table calls with manageable chunks (50-100 cells per call) rather than one giant call.
When organizing data across multiple topics, use create_sheet to create separate sheets for better organization.

Always use set_from_table when you need to write data, as it matches the format you'll receive from get_excel_tables."""
    
    def process_query(self, user_query: str, conversation_history: Optional[List[Dict[str, str]]] = None, max_iterations: int = 40) -> Dict[str, Any]:
        """
        Process a user query with tool calling and agent loop
        
        Args:
            user_query: User's query
            conversation_history: Optional conversation history
            max_iterations: Maximum number of agent loop iterations
            
        Returns:
            Response dictionary with text, functionCalls, and functionResults
        """
        if conversation_history is None:
            conversation_history = []
        
        try:
            # Get sheets info for context (saves API calls)
            sheets_info = None
            try:
                sheets_info = self.api_client.getAllSheets()
            except Exception as e:
                print(f"Warning: Could not fetch sheets for context: {e}")
            
            # Build conversation history
            # Note: Gemini SDK expects history as a list of Content objects
            # Each Content has role ("user" or "model") and parts (list of Part objects)
            history = []
            
            # Add system prompt as first message
            system_prompt = self._get_system_prompt(sheets_info)
            history.append({
                "role": "user",
                "parts": [{"text": system_prompt}]
            })
            
            history.append({
                "role": "model",
                "parts": [{"text": "I understand. I will use the Excel table format (values_table and formulas_table) when reading and writing spreadsheet data. I have access to tools to interact with FortuneSheet. For complex tasks, I will break them into smaller steps."}]
            })
            
            # Add conversation history
            for msg in conversation_history:
                role = msg.get("role", "user")
                # Ensure role is valid
                if role not in ["user", "model"]:
                    role = "user"
                history.append({
                    "role": role,
                    "parts": [{"text": msg.get("content", "")}]
                })
            
            # Start chat session (tools are already configured in the model)
            chat = self.model.start_chat(history=history)
            
            # Agent loop: continue until task is complete or max iterations
            all_function_calls = []
            all_function_results = []
            iteration = 0
            final_text = None
            response = None  # Initialize response variable
            
            current_query = user_query
            
            while iteration < max_iterations:
                # Send query or function results
                try:
                    if iteration == 0:
                        # First iteration: send user query as string
                        response = chat.send_message(current_query)
                    else:
                        # Subsequent iterations: send function results back
                        # send_message expects function responses as a list of Part-like dicts
                        # Each dict should have "function_response" key with "name" and "response"
                        if isinstance(current_query, list) and len(current_query) > 0:
                            # Verify format before sending
                            # Each item should be: {"function_response": {"name": "...", "response": {...}}}
                            valid_parts = []
                            for item in current_query:
                                if isinstance(item, dict) and "function_response" in item:
                                    fr = item["function_response"]
                                    if isinstance(fr, dict) and "name" in fr and "response" in fr:
                                        if fr["name"]:  # Ensure name is not empty
                                            valid_parts.append(item)
                            
                            if valid_parts:
                                response = chat.send_message(valid_parts)
                            else:
                                print("⚠️ No valid function responses to send")
                                break
                        else:
                            break
                
                except Exception as send_error:
                    # Handle MALFORMED_FUNCTION_CALL and other exceptions
                    error_type = type(send_error).__name__
                    error_str = str(send_error)
                    
                    # Check if it's a StopCandidateException with MALFORMED_FUNCTION_CALL
                    is_malformed = (
                        "StopCandidateException" in error_type or 
                        "MALFORMED_FUNCTION_CALL" in error_str or
                        "finish_reason: MALFORMED_FUNCTION_CALL" in error_str
                    )
                    
                    if is_malformed:
                        print(f"⚠️ Gemini generated a malformed function call. Error: {send_error}")
                        
                        # Try to extract any text response from the error
                        try:
                            # The exception might contain a candidate with text
                            if hasattr(send_error, 'candidate'):
                                candidate = send_error.candidate
                                if hasattr(candidate, 'content') and candidate.content:
                                    parts = candidate.content.parts
                                    for part in parts:
                                        if hasattr(part, 'text') and part.text:
                                            final_text = part.text
                                            print(f"📝 Extracted text from malformed response: {final_text[:100]}...")
                                            break
                        except:
                            pass
                        
                        # If we have function calls already, continue with those
                        if all_function_calls:
                            print(f"⚠️ Continuing with {len(all_function_calls)} previously executed function calls")
                            # Break the loop and return what we have
                            if not final_text:
                                final_text = f"Task partially completed. Executed {len(all_function_calls)} function call(s), but encountered a malformed function call error. Check your spreadsheet to see the results."
                            break
                        else:
                            # No function calls yet, this is a real error
                            error_msg = (
                                f"⚠️ Gemini generated a malformed function call. This usually happens when:\n"
                                f"1. The request is too complex (try breaking it into smaller steps)\n"
                                f"2. The function call payload is too large\n"
                                f"3. Multiple function calls are generated simultaneously\n\n"
                                f"Error details: {send_error}\n\n"
                                f"Try rephrasing your request or asking for one step at a time."
                            )
                            raise Exception(error_msg)
                    
                    # For other exceptions, re-raise
                    raise
                
                # Check for function calls
                function_calls = []
                if hasattr(response, 'candidates') and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and candidate.content:
                        parts = candidate.content.parts
                        for part in parts:
                            if hasattr(part, 'function_call'):
                                try:
                                    # Extract function call details
                                    func_call = part.function_call
                                    func_name = getattr(func_call, 'name', '').strip()
                                    
                                    # Validate function name - skip if empty
                                    if not func_name:
                                        print(f"⚠️ Warning: Empty function name in function_call, skipping")
                                        continue
                                    
                                    # Convert args from protobuf to dict
                                    # Handle MapComposite and other protobuf types
                                    func_args = self._convert_protobuf_to_dict(func_call.args)
                                    
                                    function_calls.append({
                                        "name": func_name,
                                        "args": func_args
                                    })
                                except Exception as func_error:
                                    print(f"⚠️ Warning: Error extracting function call: {func_error}, skipping")
                                    continue
                
                if not function_calls:
                    # No more function calls - task is complete
                    try:
                        final_text = response.text
                    except:
                        final_text = str(response)
                    break
                
                # Execute function calls
                function_results = []
                for call in function_calls:
                    tool_name = call.get("name", "").strip()
                    args = call.get("args", {})
                    
                    # Validate tool name
                    if not tool_name:
                        print(f"⚠️ Warning: Empty or missing tool name in function call: {call}")
                        continue
                    
                    # Ensure args is a proper dict and JSON-serializable
                    # Convert protobuf objects to Python dict if needed
                    if not isinstance(args, dict):
                        args = self._convert_protobuf_to_dict(args)
                    else:
                        # Recursively convert any protobuf values in the dict
                        args = {k: self._convert_protobuf_value(v) for k, v in args.items()}
                    
                    # Print tool execution (args is now guaranteed to be JSON-serializable)
                    try:
                        print(f"🔧 Executing tool: {tool_name}", json.dumps(args, indent=2, default=str))
                    except Exception as e:
                        print(f"🔧 Executing tool: {tool_name} (args: {args})")
                    
                    tool_result = self.tools.execute_tool(tool_name, args)
                    
                    # Format function response for Gemini API
                    if isinstance(tool_result, dict) and tool_result.get("error"):
                        response_data = {
                            "error": True,
                            "message": tool_result.get("message", ""),
                            "details": tool_result.get("details")
                        }
                    elif isinstance(tool_result, list):
                        response_data = {"result": tool_result}
                    elif isinstance(tool_result, dict):
                        response_data = tool_result
                    else:
                        response_data = {"result": tool_result}
                    
                    # Create function response in Gemini format
                    # Ensure tool_name is not empty
                    if not tool_name:
                        print(f"⚠️ Warning: Empty tool name detected, skipping function response")
                        continue
                    
                    # Format as Part with function_response
                    # Gemini SDK expects function responses as dicts with "function_response" key
                    # The format should match what the SDK expects for Part objects
                    function_result_part = {
                        "function_response": {
                            "name": tool_name,
                            "response": response_data
                        }
                    }
                    function_results.append(function_result_part)
                    
                    all_function_calls.append(call)
                    all_function_results.append({
                        "name": tool_name,
                        "response": response_data
                    })
                
                # Prepare function results for next iteration
                # If we have function results, send them; otherwise break
                if function_results:
                    current_query = function_results
                else:
                    # No valid function results, break the loop
                    break
                iteration += 1
            
            # Handle empty response
            if not final_text or not final_text.strip():
                # If response is None (exception occurred), try to get info from error
                if response is None:
                    # Response was never set due to exception
                    if all_function_calls:
                        final_text = f"Task partially completed. Executed {len(all_function_calls)} function call(s), but encountered an error. Check your spreadsheet to see the results."
                    else:
                        final_text = "An error occurred while processing the request. Please try again or break the task into smaller steps."
                    return {
                        "text": final_text,
                        "functionCalls": all_function_calls,
                        "functionResults": all_function_results
                    }
                
                candidates = getattr(response, 'candidates', [])
                finish_reason = None
                safety_ratings = None
                
                if candidates:
                    candidate = candidates[0]
                    finish_reason = getattr(candidate, 'finish_reason', None)
                    safety_ratings = getattr(candidate, 'safety_ratings', None)
                
                # Check if we reached max iterations
                if iteration >= max_iterations:
                    summary = f"Task completed after {iteration} iterations. "
                    if all_function_calls:
                        summary += f"Executed {len(all_function_calls)} function call(s)."
                    return {
                        "text": f"✅ {summary}\n\nThe model has completed its task by executing the necessary function calls. Check your spreadsheet to see the results.",
                        "functionCalls": all_function_calls,
                        "functionResults": all_function_results
                    }
                
                # Check finish reason
                # FinishReason.STOP (1) means normal completion
                # If we have function calls, this is actually a success
                finish_reason_value = None
                if finish_reason:
                    # Get the integer value of the enum
                    try:
                        finish_reason_value = finish_reason.value if hasattr(finish_reason, 'value') else int(finish_reason)
                    except:
                        finish_reason_value = str(finish_reason)
                
                # If finish reason is STOP (1) and we have function calls, it's a success
                if finish_reason_value == 1 and all_function_calls:
                    summary = f"Task completed successfully. Executed {len(all_function_calls)} function call(s)."
                    return {
                        "text": f"✅ {summary}\n\nThe model has completed its task by executing the necessary function calls. Check your spreadsheet to see the results.",
                        "functionCalls": all_function_calls,
                        "functionResults": all_function_results
                    }
                
                # Otherwise, it might be an error or safety issue
                debug = {
                    "finishReason": finish_reason_value if finish_reason_value is not None else finish_reason,
                    "safetyRatings": str(safety_ratings) if safety_ratings else None,
                    "functionCallsExecuted": len(all_function_calls)
                }
                
                print("⚠️ Gemini returned empty text response.", debug)
                
                # If we have function calls, it's still somewhat successful
                if all_function_calls:
                    return {
                        "text": f"⚠️ The model completed {len(all_function_calls)} function call(s) but didn't provide a text summary.\n\nFinish reason: {debug.get('finishReason')}\n\nCheck your spreadsheet to see if the task was completed.",
                        "functionCalls": all_function_calls,
                        "functionResults": all_function_results
                    }
                
                return {
                    "text": f"⚠️ Gemini returned an empty response. This is usually due to safety/blocked output or a finish reason that produced no text.\n\nIf you want, try rephrasing the request (e.g., avoid asking for 'perfectly' or extremely broad tasks) or ask it to do one step at a time.\n\nDebug:\n{json.dumps(debug, indent=2)}",
                    "functionCalls": all_function_calls,
                    "functionResults": all_function_results
                }
            
            # Check if this was a financial model task and perform final review
            is_financial_model_task = any(keyword in user_query.lower() for keyword in [
                'financial model', '3 statement', 'income statement', 'balance sheet', 
                'cash flow', 'revenue model', 'assumptions', 'model'
            ])
            
            if is_financial_model_task and all_function_calls:
                print("🔍 Performing final review of all sheets...")
                try:
                    # Check pending updates queue
                    pending_info = self.api_client.getAllPendingUpdates()
                    total_pending = pending_info.get('total_updates_queued', 0)
                    
                    if total_pending > 0:
                        print(f"📥 {total_pending} updates still in queue across {pending_info.get('total_sheets_with_pending', 0)} sheet(s)")
                        for sheet_id, info in pending_info.get('sheets', {}).items():
                            if info.get('updates_count', 0) > 0:
                                print(f"   - {info.get('sheet_name')}: {info.get('updates_count')} updates queued")
                    
                    # Get all sheets' data for verification
                    all_sheets_data = self.api_client.getAllSheetsExcelTables()
                    sheets_info = all_sheets_data.get('sheets', {})
                    
                    review_summary = []
                    for sheet_id, sheet_data in sheets_info.items():
                        sheet_name = sheet_data.get('sheet_name', 'Unknown')
                        values_count = sheet_data.get('values_count', 0)
                        formulas_count = sheet_data.get('formulas_count', 0)
                        
                        if values_count > 0 or formulas_count > 0:
                            review_summary.append(f"✅ {sheet_name}: {values_count} value rows, {formulas_count} formula rows")
                        else:
                            review_summary.append(f"⚠️ {sheet_name}: Empty or error")
                    
                    if review_summary:
                        final_text = f"{final_text}\n\n📋 **Final Review:**\n" + "\n".join(review_summary)
                        if total_pending > 0:
                            final_text += f"\n\n📥 {total_pending} updates are queued and will appear in FortuneSheet within 2-3 seconds."
                            
                except Exception as e:
                    print(f"Warning: Could not perform final review: {e}")
            
            return {
                "text": final_text,
                "functionCalls": all_function_calls,
                "functionResults": all_function_results
            }
        
        except Exception as error:
            print(f"Error processing query: {error}")
            import traceback
            traceback.print_exc()
            raise
    
    def process_table_query(self, user_query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """
        Process a query that expects table format output
        
        Args:
            user_query: User's query
            conversation_history: Optional conversation history
            
        Returns:
            Response dictionary with extracted table if found
        """
        response = self.process_query(user_query, conversation_history)
        
        # Try to extract JSON from response if LLM outputs it
        text = response.get("text", "")
        json_match = None
        
        # Look for JSON pattern
        import re
        pattern = r'\{[\s\S]*"values_table"[\s\S]*\}'
        match = re.search(pattern, text)
        if match:
            json_match = match.group(0)
        
        if json_match:
            try:
                parsed = json.loads(json_match)
                response["extractedTable"] = parsed
            except json.JSONDecodeError:
                pass
        
        return response

