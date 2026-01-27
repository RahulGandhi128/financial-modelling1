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
