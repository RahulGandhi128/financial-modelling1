/**
 * AI Service Client - Connects FortuneSheet app to AI service
 * This script runs in the browser and connects the app to the AI API server
 */

class FortuneSheetAIClient {
  constructor(apiUrl = "http://localhost:5000") {
    this.apiUrl = apiUrl;
    this.connected = false;
  }

  /**
   * Initialize connection and set up data sync
   */
  async init() {
    try {
      // Test connection
      const response = await fetch(`${this.apiUrl}/api/health`);
      if (response.ok) {
        this.connected = true;
        console.log("AI Service connected:", this.apiUrl);
        this.setupDataSync();
        return true;
      }
    } catch (error) {
      console.warn("AI Service not available:", error.message);
      this.connected = false;
      return false;
    }
  }

  /**
   * Set up automatic data synchronization
   */
  setupDataSync() {
    // Create AI service interface for the app
    window.aiService = {
      onDataChange: async (data) => {
        if (this.connected) {
          try {
            const response = await fetch(`${this.apiUrl}/api/workbook/update`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            if (response.ok) {
              console.log("Data synced to AI service:", data.length, "sheets");
            } else {
              console.error("Failed to sync data:", response.statusText);
            }
          } catch (error) {
            console.error("Failed to sync data to AI service:", error);
          }
        }
      },
      onOp: async (ops) => {
        // Handle operations if needed
        // For now, we sync full data on change
      },
    };
    
    // Start polling for pending updates
    this.startPollingForUpdates();

    // Try initial sync with retries (workbook might not be ready yet)
    const tryInitialSync = (attempts = 0) => {
      if (window.workbookRef?.current) {
        try {
          const allSheets = window.workbookRef.current.getAllSheets();
          if (allSheets && allSheets.length > 0) {
            console.log("Initial sync to AI service:", allSheets.length, "sheets");
            window.aiService.onDataChange(allSheets);
            return;
          }
        } catch (error) {
          console.warn("Error getting sheets:", error);
        }
      }
      
      // Retry up to 5 times with increasing delays
      if (attempts < 5) {
        setTimeout(() => tryInitialSync(attempts + 1), 500 * (attempts + 1));
      }
    };
    
    // Start trying after a short delay
    setTimeout(() => tryInitialSync(), 500);
  }

  /**
   * Get sheet by ID (non-empty cells only)
   */
  async getSheetCelldata(sheetId) {
    if (!this.connected) {
      throw new Error("AI Service not connected");
    }
    const response = await fetch(`${this.apiUrl}/api/sheet/${sheetId}/celldata`);
    if (!response.ok) {
      throw new Error(`Failed to get sheet: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all sheets
   */
  async getAllSheets() {
    if (!this.connected) {
      throw new Error("AI Service not connected");
    }
    const response = await fetch(`${this.apiUrl}/api/sheets`);
    if (!response.ok) {
      throw new Error(`Failed to get sheets: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Poll for pending updates and apply them to the spreadsheet
   */
  startPollingForUpdates() {
    const pollInterval = 2000; // Poll every 2 seconds
    
    const poll = async () => {
      if (!this.connected || !window.workbookRef?.current) {
        setTimeout(poll, pollInterval);
        return;
      }
      
      try {
        // First, check for pending sheet creations
        await this.checkAndApplyNewSheets();
        
        // Get all sheets
        const sheets = await this.getAllSheets();
        
        for (const sheet of sheets) {
          // Get pending updates for this sheet
          const response = await fetch(`${this.apiUrl}/api/sheet/${sheet.id}/pending-updates`);
          if (!response.ok) continue;
          
          const data = await response.json();
          if (data.updates && data.updates.length > 0) {
            // Apply updates to the spreadsheet
            await this.applyUpdates(sheet.id, data.updates);
            
            // Clear pending updates after applying
            await fetch(`${this.apiUrl}/api/sheet/${sheet.id}/pending-updates`, {
              method: "DELETE",
            });
          }
        }
      } catch (error) {
        console.warn("Error polling for updates:", error);
      }
      
      setTimeout(poll, pollInterval);
    };
    
    // Start polling after a delay
    setTimeout(poll, 3000);
  }

  /**
   * Check for and apply new sheets created by the AI service
   */
  async checkAndApplyNewSheets() {
    if (!window.workbookRef?.current) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/pending-sheet-creations`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.sheets && data.sheets.length > 0) {
        const workbook = window.workbookRef.current;
        
        for (const sheetInfo of data.sheets) {
          try {
            // Check if sheet already exists
            const allSheets = workbook.getAllSheets();
            const sheetExists = allSheets.some(s => s.id === sheetInfo.id);
            
            if (!sheetExists) {
              // Add the sheet using the API with the specific ID
              workbook.addSheet(sheetInfo.id);
              
              // Wait a bit for the sheet to be created
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Set the sheet name
              if (sheetInfo.name) {
                try {
                  workbook.setSheetName(sheetInfo.name, { id: sheetInfo.id });
                } catch (nameError) {
                  console.warn(`Failed to set sheet name for ${sheetInfo.id}:`, nameError);
                }
              }
              
              console.log(`✅ Added new sheet: ${sheetInfo.name} (ID: ${sheetInfo.id})`);
            }
          } catch (error) {
            console.warn(`Failed to add sheet ${sheetInfo.name}:`, error);
          }
        }
        
        // Clear pending sheet creations after applying
        if (data.sheets.length > 0) {
          await fetch(`${this.apiUrl}/api/pending-sheet-creations`, {
            method: "DELETE",
          });
          console.log(`Cleared ${data.sheets.length} pending sheet creation(s)`);
        }
      }
    } catch (error) {
      console.warn("Error checking for new sheets:", error);
    }
  }

  /**
   * Apply updates to the spreadsheet
   */
  async applyUpdates(sheetId, updates) {
    if (!window.workbookRef?.current) {
      console.warn("Workbook ref not available");
      return;
    }
    
    try {
      const workbook = window.workbookRef.current;
      
      // Verify the sheet exists before applying updates
      const allSheets = workbook.getAllSheets();
      const sheet = allSheets.find(s => s.id === sheetId);
      
      if (!sheet) {
        console.warn(`⚠️ Sheet with ID ${sheetId} not found in workbook. Available sheets:`, 
          allSheets.map(s => `${s.name} (${s.id})`).join(', '));
        console.warn(`   Updates will be skipped. Sheet may need to be created first.`);
        return;
      }
      
      // Get sheet name for logging
      const sheetName = sheet.name || 'Unknown';
      console.log(`📝 Applying ${updates.length} updates to sheet "${sheetName}" (ID: ${sheetId})`);
      
      // Activate the target sheet first to ensure updates go to the correct sheet
      // This is critical - setCellValue might not respect the id option in all cases
      try {
        workbook.activateSheet({ id: sheetId });
        console.log(`   ✅ Activated sheet "${sheetName}"`);
        // Wait a bit for sheet to fully activate
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (activateError) {
        console.error(`   ❌ Failed to activate sheet ${sheetId}:`, activateError);
        // Continue anyway - might still work with id option
      }
      
      // Apply each update
      let successCount = 0;
      let errorCount = 0;
      
      for (const update of updates) {
        const { row, col, value, formula, cell } = update;
        
        try {
          if (formula) {
            // Set formula - try with id option first, fallback to current sheet (we activated above)
            try {
              workbook.setCellValue(row, col, formula, { id: sheetId });
            } catch (e) {
              // Fallback: use current sheet (we activated it above)
              workbook.setCellValue(row, col, formula);
            }
          } else if (value !== null && value !== undefined) {
            // Set value - try with id option first, fallback to current sheet (we activated above)
            try {
              workbook.setCellValue(row, col, value, { id: sheetId });
            } catch (e) {
              // Fallback: use current sheet (we activated it above)
              workbook.setCellValue(row, col, value);
            }
          }
          successCount++;
        } catch (error) {
          errorCount++;
          console.warn(`   ⚠️ Failed to set cell ${cell || `${row},${col}`}:`, error.message || error);
        }
      }
      
      if (errorCount > 0) {
        console.warn(`⚠️ Applied ${successCount}/${updates.length} updates to sheet "${sheetName}" (${errorCount} errors)`);
      } else {
        console.log(`✅ Successfully applied ${successCount} updates to sheet "${sheetName}"`);
      }
    } catch (error) {
      console.error(`❌ Error applying updates to sheet ${sheetId}:`, error);
    }
  }
}

// Auto-initialize when script loads
if (typeof window !== "undefined") {
  const aiClient = new FortuneSheetAIClient();
  
  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(() => aiClient.init(), 1000); // Wait a bit for app to load
    });
  } else {
    setTimeout(() => aiClient.init(), 1000);
  }
  
  window.aiClient = aiClient;
}

