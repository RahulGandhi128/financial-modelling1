# FortuneSheet Application Setup Guide

## Overview

This setup includes:
1. **FortuneSheet Application** - The main spreadsheet app (Port 3000)
2. **AI Service** - Separate API service for AI processing (Port 5000)

## Quick Start

### 1. Install Dependencies

```bash
# Install main app dependencies
yarn install

# Install AI service dependencies
cd ai
npm install
cd ..
```

### 2. Install Vite (if not already installed)

```bash
yarn add -D vite @vitejs/plugin-react
```

### 3. Start the AI Service

In one terminal:

```bash
cd ai
npm start
```

The AI service will run on `http://localhost:5000`

### 4. Start the FortuneSheet Application

In another terminal:

```bash
yarn app
```

The app will run on `http://localhost:3000` and automatically connect to the AI service.

## Architecture

```
┌─────────────────────────────────┐
│  FortuneSheet App (Port 3000)   │
│  - React Application            │
│  - Uses FortuneSheet library    │
└──────────────┬──────────────────┘
               │ HTTP POST
               │ (syncs data)
               ▼
┌─────────────────────────────────┐
│  AI Service (Port 5000)         │
│  - Express API Server           │
│  - Stores workbook data         │
│  - Provides APIs for AI access │
└──────────────┬──────────────────┘
               │ HTTP GET
               │ (API calls)
               ▼
┌─────────────────────────────────┐
│  Python AI Client               │
│  - test_apis.py                 │
│  - Connects to AI Service       │
└─────────────────────────────────┘
```

## Running the Application

### Option 1: Run Actual Application (Recommended)

```bash
yarn app
```

This runs the **actual FortuneSheet application** on port 3000.

### Option 2: Run Storybook (Development Tool)

```bash
yarn dev
# or
yarn storybook
```

This runs **Storybook** (a component development tool) on port 6006. This is for development/testing components, not the actual app.

## Testing the AI Service

### 1. Make sure both services are running:
- FortuneSheet app: `http://localhost:3000`
- AI service: `http://localhost:5000`

### 2. Use the app to create/edit data

### 3. Test with Python script:

```bash
cd ai
pip install -r requirements.txt
python test_apis.py
```

The script will:
- Connect to the AI service
- Get all sheets
- Test both APIs (getSheet and getSheetCelldata)
- Show results with non-empty cells only

## API Endpoints

The AI service provides:

- `GET /api/health` - Health check
- `GET /api/sheets` - List all sheets
- `GET /api/sheet/:id` - Get sheet by ID (full data)
- `GET /api/sheet/:id/celldata` - Get sheet by ID (non-empty cells only)
- `GET /api/sheet/index/:index` - Get sheet by index (full data)
- `GET /api/sheet/index/:index/celldata` - Get sheet by index (non-empty cells only)
- `POST /api/workbook/update` - Update workbook data (called by app)

## Differences from Before

### Before:
- Only Storybook was available (port 6006)
- Test script used hardcoded data
- No connection between app and AI service

### Now:
- **Actual application** runs on port 3000
- **AI service** runs on port 5000
- **Automatic data sync** from app to AI service
- **Real-time API access** to actual sheet data
- **Python script** connects to real data (not hardcoded)

## Troubleshooting

### App not connecting to AI service?
- Make sure AI service is running first
- Check browser console for connection messages
- Verify CORS is enabled in AI service

### No data in AI service?
- Make sure you've created/edited data in the app
- Data syncs automatically when you make changes
- Check AI service logs for incoming data

### Python script can't connect?
- Make sure AI service is running (`npm start` in ai folder)
- Make sure app has synced data to AI service
- Check that you have `requests` installed: `pip install requests`

## Next Steps

1. Add AI model integration (OpenAI, Anthropic, etc.)
2. Add context extraction utilities
3. Add AI-powered features (formula suggestions, data analysis, etc.)
4. Connect to actual AI services

