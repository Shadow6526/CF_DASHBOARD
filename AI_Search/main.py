#!/home/Desktop/Coding/Devlopment/AI_Search/venv/bin/python3
"""
AI Search Bar - Main Entry Point
A floating desktop search bar powered by Gemini AI for Ubuntu Linux.

Usage:
    python3 main.py

Global Shortcut: Copilot Key to toggle visibility
"""
import sys
import os
import signal
import threading

from PyQt5.QtWidgets import QApplication
from PyQt5.QtCore import Qt, QTimer

from search_widget import AISearchBar
from config import get_api_key


def setup_global_shortcut(search_bar):
    """
    Setup global keyboard shortcut (Copilot Key) using pynput.
    This works even when the app is not focused.
    """
    try:
        from pynput import keyboard

        def on_press(key):
            # Check for Copilot button (VK: 269025201)
            if getattr(key, 'vk', None) == 269025201:
                # Use QTimer to safely call from main thread
                QTimer.singleShot(0, search_bar._toggle_visibility)

        listener = keyboard.Listener(on_press=on_press)
        listener.daemon = True
        listener.start()
        return listener

    except ImportError:
        return None
    except Exception as e:
        return None


def main():
    # Allow Ctrl+C to kill the app
    signal.signal(signal.SIGINT, signal.SIG_DFL)

    # High DPI support
    QApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)

    app = QApplication(sys.argv)
    app.setApplicationName("AI Search Bar")
    app.setQuitOnLastWindowClosed(False)  # Keep running in tray

    # Set global font
    from PyQt5.QtGui import QFont
    app.setFont(QFont("Segoe UI", 11))

    # Create search bar
    search_bar = AISearchBar()

    # Check if API key is set
    if not get_api_key():
        pass

    # Setup global shortcut
    listener = setup_global_shortcut(search_bar)

    # Show the search bar
    search_bar.show()
    search_bar.search_input.setFocus()

    exit_code = app.exec_()

    if listener:
        listener.stop()

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
