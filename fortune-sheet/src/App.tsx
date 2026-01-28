import React, { useCallback, useRef, useEffect, useState } from "react";
import { Workbook, WorkbookInstance } from "@fortune-sheet/react";
import { Sheet } from "@fortune-sheet/core";
import {
  FortuneExcelHelper,
  importToolBarItem,
  exportToolBarItem,
} from "@corbe30/fortune-excel";
// Import CSS from dist folder (using relative path since alias points to src)
import "../packages/react/dist/index.css";

// Declare global types for AI service
declare global {
  interface Window {
    workbookRef: React.RefObject<WorkbookInstance> | null;
    aiService?: {
      onDataChange: (data: Sheet[]) => void;
      onOp: (ops: any[]) => void;
    };
  }
}

const App: React.FC = () => {
  const workbookRef = useRef<WorkbookInstance>(null);
  const [workbookKey, setWorkbookKey] = useState(0);
  // Start with empty sheet - ready for real-world data
  const [data, setData] = React.useState<Sheet[]>([
    {
      name: "Sheet1",
      order: 0,
      row: 84,
      column: 60,
    },
  ]);

  const onChange = useCallback((newData: Sheet[]) => {
    setData(newData);
    // Send data to AI service when data changes
    if (window.aiService) {
      window.aiService.onDataChange(newData);
    }
  }, []);

  const onOp = useCallback((ops: any[]) => {
    // Send operations to AI service
    if (window.aiService) {
      window.aiService.onOp(ops);
    }
  }, []);

  // Expose workbook ref to window for AI service access and sync initial data
  useEffect(() => {
    (window as any).workbookRef = workbookRef;
    
    // Sync initial data to AI service when workbook is ready
    const syncInitialData = () => {
      if (window.aiService && workbookRef.current) {
        try {
          const allSheets = workbookRef.current.getAllSheets();
          if (allSheets && allSheets.length > 0) {
            console.log("Syncing initial data to AI service:", allSheets.length, "sheets");
            window.aiService.onDataChange(allSheets);
          }
        } catch (error) {
          console.warn("Failed to sync initial data:", error);
        }
      }
    };
    
    // Try to sync immediately, then retry after a delay
    syncInitialData();
    const timeoutId = setTimeout(syncInitialData, 2000);
    
    return () => {
      clearTimeout(timeoutId);
      (window as any).workbookRef = null;
    };
  }, [data]); // Re-sync when data changes

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <FortuneExcelHelper
        setKey={setWorkbookKey}
        setSheets={setData}
        // Pass the workbook ref so export/import helpers can access
        // getAllSheets, getSheet, setColumnWidth, setRowHeight, etc.
        sheetRef={workbookRef as any}
        config={{
          import: { xlsx: true, csv: true },
          export: { xlsx: true, csv: true },
        }}
      />
      <Workbook
        key={workbookKey}
        ref={workbookRef}
        data={data}
        onChange={onChange}
        onOp={onOp}
        customToolbarItems={[importToolBarItem(), exportToolBarItem()]}
      />
    </div>
  );
};

export default App;

