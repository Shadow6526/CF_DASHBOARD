"""
Configuration for AI Search Bar
"""
import os
import json

CONFIG_DIR = os.path.expanduser("~/.config/ai-search-bar")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

DEFAULT_CONFIG = {
    "gemini_api_key": "",
    "shortcut": "ctrl+space",
    "position_x": -1,   # -1 means center
    "position_y": 20,
    "width": 680,
    "opacity": 0.95,
    "max_response_lines": 12,
}


def load_config():
    """Load config from file, create default if not exists."""
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR, exist_ok=True)

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                saved = json.load(f)
                config = {**DEFAULT_CONFIG, **saved}
                return config
        except (json.JSONDecodeError, IOError):
            pass

    save_config(DEFAULT_CONFIG)
    return DEFAULT_CONFIG.copy()


def save_config(config):
    """Save config to file."""
    if not os.path.exists(CONFIG_DIR):
        os.makedirs(CONFIG_DIR, exist_ok=True)

    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_api_key():
    """Get Gemini API key from config."""
    config = load_config()
    return config.get("gemini_api_key", "")


def set_api_key(key):
    """Set Gemini API key in config."""
    config = load_config()
    config["gemini_api_key"] = key
    save_config(config)
