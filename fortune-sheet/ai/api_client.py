"""
FortuneSheet API Client for Python LLM Service
Essential API functions for LLM tools
"""

import requests
from typing import Dict, List, Optional, Any


class FortuneSheetAPIClient:
    """Python client for FortuneSheet API"""
    
    def __init__(self, api_url: str = "http://localhost:5000"):
        """
        Initialize API client
        
        Args:
            api_url: Base URL of the API server
        """
        self.api_url = api_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    def health_check(self) -> bool:
        """Check if API service is available"""
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
    
    def getAllSheets(self) -> List[Dict[str, Any]]:
        """Get all sheets metadata"""
        response = self.session.get(f"{self.api_url}/api/sheets")
        response.raise_for_status()
        return response.json()
    
    def getExcelTables(self, sheet_id: str) -> Dict[str, Any]:
        """Get Excel-like tables (values and formulas) from a sheet"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/excel-tables")
        response.raise_for_status()
        return response.json()
    
    def setCell(self, sheet_id: str, cell: str, value: Any = None, formula: Optional[str] = None) -> Dict[str, Any]:
        """Set a single cell value or formula"""
        payload = {"cell": cell}
        if value is not None:
            payload["value"] = value
        if formula:
            payload["formula"] = formula
        
        response = self.session.post(
            f"{self.api_url}/api/sheet/{sheet_id}/cell",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def setCells(self, sheet_id: str, cells: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Set multiple cells at once"""
        response = self.session.post(
            f"{self.api_url}/api/sheet/{sheet_id}/cells",
            json={"cells": cells}
        )
        response.raise_for_status()
        return response.json()
    
    def setFromTable(self, sheet_id: str, values_table: Optional[Dict] = None, formulas_table: Optional[Dict] = None) -> Dict[str, Any]:
        """Apply data using table format (AI model output format)"""
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
    
    def getPendingUpdates(self, sheet_id: str) -> Dict[str, Any]:
        """Get pending updates for a sheet"""
        response = self.session.get(f"{self.api_url}/api/sheet/{sheet_id}/pending-updates")
        response.raise_for_status()
        return response.json()
    
    def clearPendingUpdates(self, sheet_id: str) -> Dict[str, Any]:
        """Clear pending updates for a sheet"""
        response = self.session.delete(f"{self.api_url}/api/sheet/{sheet_id}/pending-updates")
        response.raise_for_status()
        return response.json()
    
    def createSheet(self, name: Optional[str] = None, order: Optional[int] = None) -> Dict[str, Any]:
        """Create a new sheet"""
        payload = {}
        if name:
            payload["name"] = name
        if order is not None:
            payload["order"] = order
        
        response = self.session.post(
            f"{self.api_url}/api/sheets",
            json=payload
        )
        response.raise_for_status()
        return response.json()
    
    def getAllPendingUpdates(self) -> Dict[str, Any]:
        """Get all pending updates across all sheets (for monitoring)"""
        response = self.session.get(f"{self.api_url}/api/pending-updates/all")
        response.raise_for_status()
        return response.json()
    
    def getAllSheetsExcelTables(self) -> Dict[str, Any]:
        """Get Excel-like tables for ALL sheets at once (for final review)"""
        response = self.session.get(f"{self.api_url}/api/sheets/excel-tables/all")
        response.raise_for_status()
        return response.json()

