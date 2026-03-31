#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  AI Search Bar - Setup Script for Ubuntu
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="${APP_DIR}/venv"
DESKTOP_FILE="$HOME/.config/autostart/ai-search-bar.desktop"

# Create virtual environment if not exists
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv "$VENV_DIR"
fi

# Install Python dependencies
"${VENV_DIR}/bin/pip" install -q PyQt5 google-genai pynput

# Create autostart entry
mkdir -p "$HOME/.config/autostart"

cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Type=Application
Name=AI Search Bar
Comment=Floating AI search bar powered by Gemini
Exec=${VENV_DIR}/bin/python3 ${APP_DIR}/main.py
Icon=system-search
Terminal=false
Categories=Utility;
StartupNotify=false
X-GNOME-Autostart-enabled=true
EOF

# Ask for API key (Skipped automatically since it's already set)
