"""
LLM Server - Main entry point for Gemini LLM integration
Provides HTTP API for interacting with Gemini 2.5 Flash
"""

import os
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from api_client import FortuneSheetAPIClient
from gemini_service import GeminiService

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"

# Load environment variables from .env file in the same directory
if ENV_FILE.exists():
    # Load with utf-8-sig to automatically handle BOM
    # Then manually fix any BOM-affected keys
    from dotenv import dotenv_values
    
    # Load values using dotenv_values which handles BOM better
    env_values = dotenv_values(ENV_FILE, encoding='utf-8-sig')
    
    # Set all values in os.environ, handling BOM-affected keys
    for key, value in env_values.items():
        # Remove BOM from key name if present
        clean_key = key.lstrip('\ufeff')
        os.environ[clean_key] = value
        # Also keep the original if it's different (for compatibility)
        if clean_key != key:
            os.environ[key] = value
    
    print(f"✅ Loaded .env file from: {ENV_FILE}")
else:
    # Try loading from current directory (fallback)
    load_dotenv(override=True)
    if os.getenv("GEMINI_API_KEY"):
        print("✅ Loaded .env file from current directory")
    else:
        print(f"⚠️  .env file not found at: {ENV_FILE}")
        print(f"   Current working directory: {os.getcwd()}")
        print(f"   Script directory: {BASE_DIR}")

app = Flask(__name__)
CORS(app)

# Configuration - also check for BOM-affected key name
PORT = int(os.getenv("LLM_PORT", "5001"))
API_URL = os.getenv("API_URL", "http://localhost:5000")
# Handle BOM issue: check both with and without BOM
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("\ufeffGEMINI_API_KEY")

# Debug: Check if API key was loaded (without showing the actual key)
if GEMINI_API_KEY:
    print(f"✅ GEMINI_API_KEY loaded (length: {len(GEMINI_API_KEY)} characters)")
    # Set it properly in environment for other code
    os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
else:
    print("❌ GEMINI_API_KEY not found in environment")
    print("   Checked both 'GEMINI_API_KEY' and '\\ufeffGEMINI_API_KEY' (BOM variant)")

# Initialize services
api_client = None
gemini_service = None


def initialize_services():
    """Initialize API client and Gemini service"""
    global api_client, gemini_service
    
    try:
        api_client = FortuneSheetAPIClient(API_URL)
        
        if not GEMINI_API_KEY:
            print("⚠️  GEMINI_API_KEY not set. LLM features will not work.")
            print("   Set GEMINI_API_KEY environment variable to enable Gemini.")
            return False
        
        gemini_service = GeminiService(GEMINI_API_KEY, api_client)
        print("✅ Gemini 2.5 Flash initialized")
        return True
    except Exception as error:
        print(f"❌ Failed to initialize Gemini service: {error}")
        return False


# Health check
@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "gemini_initialized": gemini_service is not None,
        "api_connected": api_client is not None,
        "timestamp": __import__("datetime").datetime.now().isoformat()
    })


# Get framework explanation
@app.route("/api/explain", methods=["GET"])
def explain_framework():
    """Get framework explanation"""
    try:
        if not api_client:
            return jsonify({"error": "API client not initialized"}), 503
        
        sheets = api_client.getAllSheets()
        return jsonify({
            "framework": "FortuneSheet AI Framework",
            "description": "LLM-powered spreadsheet assistant with automatic sheet discovery",
            "features": [
                "Automatic sheet discovery - LLM knows about sheets without extra API calls",
                "Function calling - LLM can read/write spreadsheet data",
                "Table format - Data sent in Excel-like format (values_table + formulas_table)",
                "Real-time sync - Changes appear in spreadsheet automatically",
                "Agent loop - Multi-step tasks broken into manageable chunks"
            ],
            "sheets": sheets,
            "tools": [
                "get_all_sheets - List all sheets (usually not needed - sheets auto-loaded)",
                "get_excel_tables - Get sheet data in table format",
                "set_from_table - Write data using table format",
                "set_cell - Set single cell",
                "set_cells - Set multiple cells",
                "create_sheet - Create a new sheet in the workbook"
            ],
            "howItWorks": {
                "step1": "LLM automatically receives sheet information on startup",
                "step2": "User asks question (e.g., 'read sheet 1')",
                "step3": "LLM uses known sheet IDs to call get_excel_tables directly",
                "step4": "LLM receives data in values_table + formulas_table format",
                "step5": "LLM can analyze and write data back using set_from_table",
                "step6": "For complex tasks, LLM breaks work into smaller steps",
                "step7": "Changes are queued and applied to spreadsheet automatically"
            }
        })
    except Exception as error:
        return jsonify({"error": str(error)}), 500


# Chat endpoint - process user query with Gemini
@app.route("/api/chat", methods=["POST"])
def chat():
    """Process chat query with Gemini"""
    if not gemini_service:
        return jsonify({
            "error": "Gemini service not initialized",
            "message": "Set GEMINI_API_KEY environment variable"
        }), 503
    
    try:
        data = request.get_json()
        query = data.get("query")
        history = data.get("history", [])
        
        if not query:
            return jsonify({"error": "query is required"}), 400
        
        print(f"📝 Processing query: {query[:100]}...")
        
        response = gemini_service.process_query(query, history)
        
        return jsonify({
            "success": True,
            "response": response.get("text", ""),
            "functionCalls": response.get("functionCalls", []),
            "functionResults": response.get("functionResults", []),
            "extractedTable": response.get("extractedTable")
        })
    except Exception as error:
        print(f"Error processing chat: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to process query",
            "message": str(error)
        }), 500


# Process table query - expects table format output
@app.route("/api/process-table", methods=["POST"])
def process_table():
    """Process query expecting table format output"""
    if not gemini_service:
        return jsonify({
            "error": "Gemini service not initialized",
            "message": "Set GEMINI_API_KEY environment variable"
        }), 503
    
    try:
        data = request.get_json()
        query = data.get("query")
        history = data.get("history", [])
        
        if not query:
            return jsonify({"error": "query is required"}), 400
        
        print(f"📊 Processing table query: {query[:100]}...")
        
        response = gemini_service.process_table_query(query, history)
        
        return jsonify({
            "success": True,
            "response": response.get("text", ""),
            "functionCalls": response.get("functionCalls", []),
            "functionResults": response.get("functionResults", []),
            "extractedTable": response.get("extractedTable")
        })
    except Exception as error:
        print(f"Error processing table query: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to process table query",
            "message": str(error)
        }), 500


# Apply AI-generated table to spreadsheet
@app.route("/api/apply-table", methods=["POST"])
def apply_table():
    """Apply AI-generated table to spreadsheet"""
    if not api_client:
        return jsonify({"error": "API client not initialized"}), 503
    
    try:
        data = request.get_json()
        sheet_id = data.get("sheet_id")
        values_table = data.get("values_table")
        formulas_table = data.get("formulas_table")
        
        if not sheet_id:
            return jsonify({"error": "sheet_id is required"}), 400
        
        if not values_table and not formulas_table:
            return jsonify({
                "error": "Either values_table or formulas_table is required"
            }), 400
        
        print(f"📝 Applying table to sheet {sheet_id}...")
        
        result = api_client.setFromTable(sheet_id, values_table, formulas_table)
        
        return jsonify({
            "success": True,
            "message": f"Applied {result.get('count', 0)} cells to spreadsheet",
            "result": result
        })
    except Exception as error:
        print(f"Error applying table: {error}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "error": "Failed to apply table",
            "message": str(error)
        }), 500


# Get available tools
@app.route("/api/tools", methods=["GET"])
def get_tools():
    """Get available tools"""
    if not gemini_service:
        return jsonify({"error": "Gemini service not initialized"}), 503
    
    tools = gemini_service.tools.get_tool_definitions()
    return jsonify({
        "tools": tools,
        "count": len(tools)
    })


if __name__ == "__main__":
    print(f"\n🚀 LLM Server starting on http://localhost:{PORT}")
    print(f"📋 API endpoints:")
    print(f"   POST /api/chat - Chat with Gemini")
    print(f"   POST /api/process-table - Process query expecting table output")
    print(f"   POST /api/apply-table - Apply table data to spreadsheet")
    print(f"   GET  /api/tools - List available tools")
    print(f"   GET  /api/health - Health check")
    print(f"   GET  /api/explain - Framework explanation\n")
    
    initialized = initialize_services()
    if initialized:
        print("✅ Ready to process queries!\n")
    else:
        print("⚠️  Set GEMINI_API_KEY to enable LLM features\n")
    
    app.run(host="0.0.0.0", port=PORT, debug=False)

