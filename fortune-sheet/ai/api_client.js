/**
 * FortuneSheet API Client
 * Essential API functions copied from test_apis.py
 * DO NOT import from test_apis.py - this is a standalone module
 */

const axios = require('axios');

class FortuneSheetAPIClient {
  constructor(apiUrl = "http://localhost:5000") {
    this.apiUrl = apiUrl;
    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/api/health');
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async getHealthInfo() {
    const response = await this.client.get('/api/health');
    return response.data;
  }

  async getAllSheets() {
    const response = await this.client.get('/api/sheets');
    return response.data;
  }

  async getExcelTables(sheetId) {
    const response = await this.client.get(`/api/sheet/${sheetId}/excel-tables`);
    return response.data;
  }

  async setCell(sheetId, cell, value = null, formula = null) {
    const response = await this.client.post(`/api/sheet/${sheetId}/cell`, {
      cell,
      value,
      formula
    });
    return response.data;
  }

  async setCells(sheetId, cells) {
    const response = await this.client.post(`/api/sheet/${sheetId}/cells`, {
      cells
    });
    return response.data;
  }

  async setFromTable(sheetId, valuesTable = null, formulasTable = null) {
    const payload = {};
    if (valuesTable) payload.values_table = valuesTable;
    if (formulasTable) payload.formulas_table = formulasTable;
    
    const response = await this.client.post(`/api/sheet/${sheetId}/from-table`, payload);
    return response.data;
  }

  async getPendingUpdates(sheetId) {
    const response = await this.client.get(`/api/sheet/${sheetId}/pending-updates`);
    return response.data;
  }

  async clearPendingUpdates(sheetId) {
    const response = await this.client.delete(`/api/sheet/${sheetId}/pending-updates`);
    return response.data;
  }
}

module.exports = FortuneSheetAPIClient;

