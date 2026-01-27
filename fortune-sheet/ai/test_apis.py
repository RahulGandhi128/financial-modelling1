#!/usr/bin/env python3
"""
FortuneSheet AI Service API Test Script
Comprehensive test suite for all available APIs
"""

import requests
import json
from typing import Dict, List, Optional, Any
from datetime import datetime


class FortuneSheetAIClient:
    """Python client for FortuneSheet AI Service"""
    
    def __init__(self, api_url: str = "http://localhost:5000"):
        """
        Initialize AI service client
        
        Args:
            api_url: Base URL of the AI service API
        """
        self.api_url = api_url
        self.session = requests.Session()
    
    def health_check(self) -> bool:
        """Check if AI service is available"""
        try:
            response = self.session.get(f"{self.api_url}/api/health", timeout=2)
            return response.status_code == 200
        except requests.exceptions.RequestException:
            return False
    
    def get_health_info(self) -> Dict[str, Any]:
        """Get detailed health information"""
        response = self.session.get(f"{self.api_url}/api/health")
        response.raise_for_status()
        return response.json()
    
    def get_all_sheets(self) -> List[Dict[str, Any]]:
        """Get all sheets metadata"""
        response = self.session.get(f"{self.api_url}/api/sheets")
        response.raise_for_status()
        return response.json()
    
    def get_sheet(self, sheet_id: Optional[str] = None, sheet_index: Optional[int] = None) -> Dict[str, Any]:
        """Get sheet by ID or index (full data including empty cells)"""
        if sheet_id:
            response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}")
        elif sheet_index is not None:
            response = self.session.get(f"{self.api_url}/api/sheet/index/{sheet_index}")
        else:
            raise ValueError("Either sheet_id or sheet_index must be provided")
        response.raise_for_status()
        return response.json()
    
    def get_sheet_celldata(self, sheet_id: Optional[str] = None, sheet_index: Optional[int] = None) -> Dict[str, Any]:
        """Get sheet by ID or index (non-empty cells only - celldata format)"""
        if sheet_id:
            response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/celldata")
        elif sheet_index is not None:
            response = self.session.get(f"{self.api_url}/api/sheet/index/{sheet_index}/celldata")
        else:
            raise ValueError("Either sheet_id or sheet_index must be provided")
        response.raise_for_status()
        return response.json()
    
    def get_cell_value(self, sheet_id: str, row: int, col: int, cell_type: str = "v") -> Dict[str, Any]:
        """Get cell value by coordinates"""
        response = self.session.get(
            f"{self.api_url}/api/sheet/{sheet_id}/cell/{row}/{col}",
            params={"type": cell_type}
        )
        response.raise_for_status()
        return response.json()
    
    def get_cells_by_range(self, sheet_id: str, range_data: Dict[str, List[int]]) -> Dict[str, Any]:
        """Get cells by range"""
        response = self.session.post(
            f"{self.api_url}/api/sheet/{sheet_id}/cells/range",
            json={"range": range_data}
        )
        response.raise_for_status()
        return response.json()
    
    def get_selection(self, sheet_id: str) -> Dict[str, Any]:
        """Get selection information"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/selection")
        response.raise_for_status()
        return response.json()
    
    def get_sheet_stats(self, sheet_id: str) -> Dict[str, Any]:
        """Get sheet statistics"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/stats")
        response.raise_for_status()
        return response.json()
    
    def search_cells(self, sheet_id: str, query: str, case_sensitive: bool = False, match_exact: bool = False) -> Dict[str, Any]:
        """Search cells by value"""
        response = self.session.post(
            f"{self.api_url}/api/sheet/{sheet_id}/search",
            json={
                "query": query,
                "case_sensitive": case_sensitive,
                "match_exact": match_exact
            }
        )
        response.raise_for_status()
        return response.json()
    
    def get_endpoints(self) -> Dict[str, Any]:
        """Get all available API endpoints"""
        response = self.session.get(f"{self.api_url}/api/endpoints")
        response.raise_for_status()
        return response.json()
    
    def get_sheet_llm(self, sheet_id: str) -> Dict[str, Any]:
        """Get sheet in LLM-readable format (no formatting, table structure)"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/llm")
        response.raise_for_status()
        return response.json()
    
    def get_sheet_formulas(self, sheet_id: str) -> Dict[str, Any]:
        """Get formula dependencies and cell references for a sheet"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/formulas")
        response.raise_for_status()
        return response.json()
    
    def get_workbook_formulas(self) -> Dict[str, Any]:
        """Get all formulas and cross-sheet dependencies across workbook"""
        response = self.session.get(f"{self.api_url}/api/workbook/formulas")
        response.raise_for_status()
        return response.json()
    
    def get_excel_tables(self, sheet_id: str) -> Dict[str, Any]:
        """Get Excel-like tables with values and formulas"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/excel-tables")
        response.raise_for_status()
        return response.json()
    
    def set_cell(self, sheet_id: str, cell: str, value: Any = None, formula: Optional[str] = None) -> Dict[str, Any]:
        """Set a single cell value"""
        response = self.session.post(
            f"{self.api_url}/api/sheet/{sheet_id}/cell",
            json={"cell": cell, "value": value, "formula": formula}
        )
        response.raise_for_status()
        return response.json()
    
    def set_cells(self, sheet_id: str, cells: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Set multiple cells at once"""
        response = self.session.post(
            f"{self.api_url}/api/sheet/{sheet_id}/cells",
            json={"cells": cells}
        )
        response.raise_for_status()
        return response.json()
    
    def set_from_table(self, sheet_id: str, values_table: Optional[Dict] = None, formulas_table: Optional[Dict] = None) -> Dict[str, Any]:
        """Set cells from Excel table format (AI model output format)"""
        payload = {}
        if values_table:
            payload["values_table"] = values_table
        if formulas_table:
            payload["formulas_table"] = formulas_table
        response = self.session.post(
            f"{self.api_url}/api/sheet/{sheet_id}/from-table",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def get_pending_updates(self, sheet_id: str) -> Dict[str, Any]:
        """Get pending updates for a sheet"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/pending-updates")
        response.raise_for_status()
        return response.json()
    
    def clear_pending_updates(self, sheet_id: str) -> Dict[str, Any]:
        """Clear pending updates for a sheet"""
        response = self.session.delete(f"{self.api_url}/api/sheet/{sheet_id}/pending-updates")
        response.raise_for_status()
        return response.json()


def print_section(title: str, width: int = 70):
    """Print a formatted section header"""
    print(f"\n{'='*width}")
    print(f"{title:^{width}}")
    print(f"{'='*width}")


def print_raw_response(response_data: Any, title: str = "Raw API Response"):
    """Print raw JSON response without modification"""
    print_section(title, 70)
    print(json.dumps(response_data, indent=2, ensure_ascii=False))


def show_menu():
    """Display test menu"""
    print("\n" + "="*70)
    print("FortuneSheet AI Service - API Test")
    print("="*70)
    print("\nAvailable Options:")
    print("  1.  Get Excel Tables (Values & Formulas)")
    print("  2.  Set Single Cell")
    print("  3.  Set Multiple Cells")
    print("  4.  Set from Table Format (AI Model Output) ⭐")
    print("  5.  Get Pending Updates")
    print("  q.  Quit")
    print("\n" + "-"*70)


def get_user_choice() -> str:
    """Get user's test choice"""
    while True:
        choice = input("\nEnter option (1-5) or 'q' to quit: ").strip().lower()
        if choice in ['1', '2', '3', '4', '5', 'q']:
            return choice
        print("❌ Invalid choice. Please enter 1-5 or 'q'.")


def get_all_sheets(client: FortuneSheetAIClient):
    """Get all sheets - helper function"""
    try:
        sheets = client.get_all_sheets()
        return sheets if len(sheets) > 0 else None
    except Exception as e:
        print(f"❌ Error getting sheets: {e}")
        return None


def print_excel_table(table_array: List[List[Any]], title: str, max_col_width: int = 18):
    """Print a table in Excel-like format with proper alignment"""
    if not table_array or len(table_array) < 2:
        print(f"  (No data)")
        return
    
    # Calculate column widths
    num_cols = len(table_array[0])
    col_widths = []
    for c in range(num_cols):
        max_width = 0
        for row in table_array:
            if c < len(row):
                cell_str = str(row[c]) if row[c] is not None else ""
                max_width = max(max_width, len(cell_str))
        col_widths.append(min(max_width, max_col_width))
    
    # Print header separator
    separator = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"
    
    print(f"\n{title}")
    print(separator)
    
    for i, row in enumerate(table_array):
        row_str = "|"
        for c, cell in enumerate(row):
            cell_str = str(cell) if cell is not None else ""
            if len(cell_str) > col_widths[c]:
                cell_str = cell_str[:col_widths[c]-2] + ".."
            # First column (row numbers) right-aligned, rest left-aligned
            if c == 0:
                row_str += f" {cell_str:>{col_widths[c]}} |"
            else:
                row_str += f" {cell_str:<{col_widths[c]}} |"
        print(row_str)
        
        # Print separator after header row
        if i == 0:
            print(separator)
    
    print(separator)


def run_excel_tables_test(client: FortuneSheetAIClient, sheet_id: str, sheet_name: str):
    """Get Excel-like Tables (Values and Formulas)"""
    print_section("Excel Tables (Values & Formulas)", 70)
    try:
        excel_data = client.get_excel_tables(sheet_id)
        
        # Print raw response first
        print("\n--- Raw API Response ---")
        print(json.dumps(excel_data, indent=2, ensure_ascii=False)[:2000])
        if len(json.dumps(excel_data)) > 2000:
            print("... (truncated)")
        
        print("\n" + "-"*70)
        print(f"\nSheet: {excel_data.get('sheet_name')} (ID: {excel_data.get('sheet_id')})")
        
        dims = excel_data.get('dimensions', {})
        print(f"Dimensions: {dims.get('rows')} rows × {dims.get('columns')} columns")
        print(f"Columns: {', '.join(dims.get('column_headers', []))}")
        print(f"Rows: {dims.get('row_start')} to {dims.get('row_end')}")
        
        # Print Values Table
        values_table = excel_data.get('values_table', {})
        values_array = values_table.get('array', [])
        print_excel_table(values_array, "📊 VALUES TABLE (shows actual cell values)")
        
        # Print Formulas Table
        formulas_table = excel_data.get('formulas_table', {})
        formulas_array = formulas_table.get('array', [])
        print_excel_table(formulas_array, "📝 FORMULAS TABLE (shows formulas where they exist)")
        
        # Print formula cells summary
        formula_cells = excel_data.get('formula_cells', [])
        if formula_cells:
            print(f"\n🔢 Formula Cells Summary ({len(formula_cells)} formulas):")
            for fc in formula_cells[:15]:
                print(f"  {fc.get('cell')}: {fc.get('formula')} → {fc.get('value')}")
            if len(formula_cells) > 15:
                print(f"  ... and {len(formula_cells) - 15} more formulas")
        else:
            print(f"\n(No formulas found in this sheet)")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        print("Note: This endpoint may not be available. Make sure API server is restarted.")
        return False


def get_sample_ai_output():
    """Get sample AI model output in table format (matching the output format)"""
    return {
        "values_table": {
            "1": {"A": "Om Freight Forwarders Ltd.", "B": None, "C": None, "D": None},
            "2": {"A": "No. of Equity Shares", "B": "Total Amount Allotted", "C": "% of Anchor Investment", "D": "Bid price (Rs. per share)"},
            "3": {"A": "4,36,896", "B": "5,89,80,960", "C": None, "D": "135"},
            "4": {"A": "3,70,407", "B": "5,00,04,945", "C": None, "D": "135"},
            "5": {"A": "3,70,407", "B": "5,00,04,945", "C": None, "D": "135"},
            "6": {"A": None, "B": None, "C": "100.00%", "D": None},
        },
        "formulas_table": {
            "3": {"C": "=B3/$B$6"},  # Calculate percentage
            "4": {"C": "=B4/$B$6"},  # Calculate percentage
            "5": {"C": "=B5/$B$6"},  # Calculate percentage
            "6": {"A": "=SUM(A3:A5)", "B": "=SUM(B3:B5)", "C": "=SUM(C3:C5)"},  # Totals
        }
    }


def run_test_2_set_cell(client: FortuneSheetAIClient, sheet_id: str):
    """Test 2: Set Single Cell"""
    print_section("TEST 2: Set Single Cell", 70)
    try:
        # Set a cell with a value
        result1 = client.set_cell(sheet_id, "A10", value="Test Value")
        print_raw_response(result1, "Set Cell A10 Response")
        
        # Set a cell with a formula
        result2 = client.set_cell(sheet_id, "B10", formula="=A10*2")
        print_raw_response(result2, "Set Cell B10 with Formula Response")
        
        print("\n✅ Cells queued for update. Check the spreadsheet in a few seconds!")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_test_3_set_cells(client: FortuneSheetAIClient, sheet_id: str):
    """Test 3: Set Multiple Cells"""
    print_section("TEST 3: Set Multiple Cells", 70)
    try:
        cells = [
            {"cell": "D10", "value": "Header 1"},
            {"cell": "E10", "value": "Header 2"},
            {"cell": "D11", "value": 100},
            {"cell": "E11", "value": 200},
            {"cell": "D12", "formula": "=SUM(D11:E11)"},
        ]
        
        result = client.set_cells(sheet_id, cells)
        print_raw_response(result, "Set Multiple Cells Response")
        
        print(f"\n✅ {result.get('count', 0)} cells queued for update. Check the spreadsheet in a few seconds!")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_test_4_set_from_table(client: FortuneSheetAIClient, sheet_id: str):
    """Test 4: Set from Table Format (AI Model Output)"""
    print_section("TEST 4: Set from Table Format (AI Model Output)", 70)
    try:
        # Get sample AI output (same format as the output tables)
        sample_data = get_sample_ai_output()
        
        print("\n📋 Sample AI Model Output (Table Format):")
        print("\nValues Table:")
        print(json.dumps(sample_data["values_table"], indent=2, ensure_ascii=False))
        print("\nFormulas Table:")
        print(json.dumps(sample_data["formulas_table"], indent=2, ensure_ascii=False))
        
        result = client.set_from_table(
            sheet_id,
            values_table=sample_data["values_table"],
            formulas_table=sample_data["formulas_table"]
        )
        
        print("\n" + "-"*70)
        print_raw_response(result, "Set from Table Format Response")
        
        print(f"\n✅ {result.get('count', 0)} cells queued for update.")
        print(f"📝 Cells to be updated: {', '.join(result.get('cells', [])[:10])}")
        if len(result.get('cells', [])) > 10:
            print(f"   ... and {len(result.get('cells', [])) - 10} more")
        print("\n⏳ Updates will appear in the spreadsheet in a few seconds!")
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_test_5_pending_updates(client: FortuneSheetAIClient, sheet_id: str):
    """Test 5: Get Pending Updates"""
    print_section("TEST 5: Get Pending Updates", 70)
    try:
        result = client.get_pending_updates(sheet_id)
        print_raw_response(result, "Pending Updates Response")
        
        updates = result.get('updates', [])
        if updates:
            print(f"\n📋 {len(updates)} pending updates:")
            for update in updates[:10]:
                cell = update.get('cell', '?')
                value = update.get('value')
                formula = update.get('formula')
                if formula:
                    print(f"  {cell}: {formula}")
                else:
                    print(f"  {cell}: {value}")
            if len(updates) > 10:
                print(f"  ... and {len(updates) - 10} more")
        else:
            print("\n✅ No pending updates")
        
        return True
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main interactive test function"""
    client = FortuneSheetAIClient()
    
    # Check if AI service is available
    print("\nChecking AI service connection...")
    if not client.health_check():
        print("❌ ERROR: AI Service is not running!")
        print("\nPlease start the AI service first:")
        print("  cd ai")
        print("  npm install")
        print("  npm start")
        print("\nAnd make sure FortuneSheet app is running and connected.")
        return
    
    print("✓ AI Service is connected!")
    
    # Interactive menu loop
    while True:
        show_menu()
        choice = get_user_choice()
        
        if choice == 'q':
            print("\nExiting...")
            break
        
        # Get sheets first (needed for most tests)
        sheets = get_all_sheets(client)
        if not sheets or len(sheets) == 0:
            print("❌ No sheets available. Make sure the app has data.")
            print("\n" + "-"*70)
            continue_choice = input("Press Enter to continue or 'q' to quit: ").strip().lower()
            if continue_choice == 'q':
                break
            continue
        
        first_sheet_id = sheets[0].get('id')
        first_sheet_name = sheets[0].get('name')
        
        if choice == '1':
            # Run Excel tables test
            run_excel_tables_test(client, first_sheet_id, first_sheet_name)
        
        elif choice == '2':
            run_test_2_set_cell(client, first_sheet_id)
        
        elif choice == '3':
            run_test_3_set_cells(client, first_sheet_id)
        
        elif choice == '4':
            run_test_4_set_from_table(client, first_sheet_id)
        
        elif choice == '5':
            run_test_5_pending_updates(client, first_sheet_id)
        
        # Ask if user wants to continue
        print("\n" + "-"*70)
        continue_choice = input("Press Enter to continue or 'q' to quit: ").strip().lower()
        if continue_choice == 'q':
            break


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nExiting...")
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Error connecting to AI service: {e}")
        print("\nMake sure:")
        print("  1. AI service is running (npm start in ai folder)")
        print("  2. FortuneSheet app is running (yarn app)")
        print("  3. App has connected to AI service")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
