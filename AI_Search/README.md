# ✦ AI Search Bar

A beautiful floating desktop search bar for **Ubuntu Linux** powered by **Google Gemini AI**.

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Ubuntu%20Linux-orange?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini-purple?style=flat-square)

## ✨ Features

- 🔍 **Floating Search Bar** - Always on top, minimal & beautiful
- 🤖 **Gemini AI Powered** - Instant, concise answers
- ⌨️ **Global Shortcut** - `Copilot Key` to toggle from anywhere
- 🎨 **Dark Glassmorphic UI** - Premium look & feel
- 🖱️ **Draggable** - Move it anywhere on your screen
- 📌 **System Tray** - Runs quietly in background
- 🚀 **Autostart** - Launches on login (optional)

## 🚀 Quick Start

### 1. Setup
```bash
chmod +x setup.sh
./setup.sh
```

### 2. Run
```bash
./venv/bin/python3 main.py
```

### 3. Set API Key
- Click the ⚙ button in the search bar
- Paste your Gemini API key
- Get one free at [ai.google.dev](https://ai.google.dev)

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Copilot Key` | Show/Hide search bar |
| `Enter` | Submit question |
| `Escape` | Collapse answer / Hide bar |

## 📁 Project Structure

```
AI_Search/
├── main.py            # Entry point + global shortcut
├── search_widget.py   # Floating search bar UI
├── gemini_client.py   # Gemini API integration
├── config.py          # Configuration management
├── setup.sh           # One-click setup script
├── requirements.txt   # Python dependencies
└── README.md          # This file
```

## 🔧 Configuration

Settings are stored at `~/.config/ai-search-bar/config.json`:

```json
{
  "gemini_api_key": "your-key-here",
  "position_y": 200,
  "width": 680
}
```

## 📦 Dependencies

- Python 3.10+
- PyQt5
- google-generativeai
- pynput
