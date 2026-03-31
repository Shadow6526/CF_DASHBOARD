"""
AI Search Bar - Floating Desktop Widget
A premium floating search bar for Ubuntu that uses Gemini AI.
"""
import sys
import threading
import os

from PyQt5.QtCore import (
    Qt, QPropertyAnimation, QEasingCurve, QSize, pyqtSignal, QObject,
    QTimer, QPoint, QRect, pyqtProperty
)
from PyQt5.QtGui import (
    QFont, QColor, QPainter, QLinearGradient, QBrush, QPen,
    QFontDatabase, QIcon, QCursor, QPainterPath, QRegion, QPixmap
)
from PyQt5.QtWidgets import (
    QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLineEdit,
    QLabel, QTextEdit, QGraphicsDropShadowEffect, QPushButton,
    QSystemTrayIcon, QMenu, QAction, QDialog, QFormLayout,
    QDialogButtonBox, QDesktopWidget, QSizePolicy, QFrame
)

from gemini_client import GeminiClient
from config import load_config, save_config, get_api_key, set_api_key


# ─── Signal bridge for thread-safe UI updates ───────────────────────────────
class SignalBridge(QObject):
    response_ready = pyqtSignal(str)
    loading_update = pyqtSignal(str)


# ─── Settings Dialog ────────────────────────────────────────────────────────
class SettingsDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Keybo ki chabi")
        self.setFixedSize(480, 220)
        self.setStyleSheet("""
            QDialog {
                background: #0A0A0A;
                color: #e0e0e0;
            }
            QLabel {
                color: #a0a0b0;
                font-size: 14px;
                font-family: 'Segoe UI', system-ui, sans-serif;
            }
            QLineEdit {
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 10px;
                padding: 12px 16px;
                color: #ffffff;
                font-size: 14px;
                selection-background-color: rgba(56, 189, 248, 0.4);
            }
            QLineEdit:focus {
                border: 1px solid #38bdf8;
                background: rgba(255, 255, 255, 0.08);
            }
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #0284c7, stop:1 #38bdf8);
                color: white;
                border: none;
                border-radius: 10px;
                padding: 10px 24px;
                font-size: 14px;
                font-weight: 600;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:0,
                    stop:0 #0ea5e9, stop:1 #7dd3fc);
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 30, 30, 30)
        layout.setSpacing(16)

        title = QLabel("Kebo ki chabi")
        title.setStyleSheet("font-size: 16px; font-weight: 700; color: #ffffff;")
        layout.addWidget(title)

        self.api_key_input = QLineEdit()
        self.api_key_input.setPlaceholderText("Chabbi De Bhai")
        self.api_key_input.setEchoMode(QLineEdit.Password)
        self.api_key_input.setText(get_api_key())
        layout.addWidget(self.api_key_input)

        hint = QLabel("Chabbi ki Dukan→ aistudio.google.com/app/apikey")
        hint.setStyleSheet("color: #38bdf8; font-size: 11px;")
        layout.addWidget(hint)

        layout.addStretch()

        btn_layout = QHBoxLayout()
        btn_layout.addStretch()

        save_btn = QPushButton("💾  Try it!!")
        save_btn.setCursor(QCursor(Qt.PointingHandCursor))
        save_btn.clicked.connect(self.save_and_close)
        btn_layout.addWidget(save_btn)

        layout.addLayout(btn_layout)

    def save_and_close(self):
        key = self.api_key_input.text().strip()
        if key:
            set_api_key(key)
        self.accept()


# ─── Main Floating Search Bar Widget ────────────────────────────────────────
class AISearchBar(QWidget):
    def __init__(self):
        super().__init__()

        self.config = load_config()
        self.ai = GeminiClient()
        self.bridge = SignalBridge()
        self.bridge.response_ready.connect(self._display_response)
        self.bridge.loading_update.connect(self._update_loading)

        self._is_expanded = False
        self._is_loading = False
        self._drag_position = None
        self._collapsed_height = 68
        self._expanded_height = 360
        self._bar_width = self.config.get("width", 680)

        self._init_ui()
        self._init_tray()
        self._position_window()

        # Loading dots animation
        self._loading_dots = 0
        self._loading_timer = QTimer()
        self._loading_timer.timeout.connect(self._animate_loading_dots)

    def _init_ui(self):
        """Initialize the user interface."""
        # ── Window flags ──
        self.setWindowFlags(
            Qt.FramelessWindowHint |
            Qt.WindowStaysOnTopHint |
            Qt.Tool  # Don't show in taskbar
        )
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedWidth(self._bar_width)
        self.setFixedHeight(self._collapsed_height)

        # ── Main container ──
        self.container = QFrame(self)
        self.container.setObjectName("mainContainer")
        self.container.setStyleSheet("""
            #mainContainer {
                background: rgba(10, 10, 10, 240);
                border: 1px solid rgba(56, 189, 248, 0.15);
                border-radius: 20px;
            }
        """)

        # ── Shadow ──
        # shadow = QGraphicsDropShadowEffect()
        # shadow.setBlurRadius(60)
        # shadow.setColor(QColor(0, 0, 0, 180))
        # shadow.setOffset(0, 10)
        # self.container.setGraphicsEffect(shadow)

        # ── Layout ──
        main_layout = QVBoxLayout(self)
        main_layout.setContentsMargins(8, 8, 8, 8)
        main_layout.addWidget(self.container)

        container_layout = QVBoxLayout(self.container)
        container_layout.setContentsMargins(16, 12, 16, 12)
        container_layout.setSpacing(0)

        # ── Search Row ──
        search_row = QHBoxLayout()
        search_row.setSpacing(10)

        # AI icon
        self.ai_icon = QLabel()
        
        # Load the icon from the icons folder
        icon_path = os.path.join(os.path.dirname(__file__), "icons", "sch.png")
        if os.path.exists(icon_path):
            pixmap = QPixmap(icon_path)
            # Scale the image to fit the 32x32 max size nicely, keeping aspect ratio
            scaled_pixmap = pixmap.scaled(28, 28, Qt.KeepAspectRatio, Qt.SmoothTransformation)
            self.ai_icon.setPixmap(scaled_pixmap)
        else:
            # Fallback if image not found
            self.ai_icon.setText("✦")
            self.ai_icon.setStyleSheet("""
                color: #38bdf8;
                font-size: 26px;
                font-weight: bold;
                padding: 0 4px;
            """)

        self.ai_icon.setFixedWidth(32)
        self.ai_icon.setAlignment(Qt.AlignCenter)
        search_row.addWidget(self.ai_icon)

        # Search input
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Puchiye Sir...")
        self.search_input.setStyleSheet("""
            QLineEdit {
                background: transparent;
                border: none;
                color: #ffffff;
                font-size: 18px;
                font-family: 'Segoe UI', system-ui, sans-serif;
                font-weight: 400;
                padding: 0px;
                selection-background-color: rgba(56, 189, 248, 0.4);
            }
            QLineEdit::placeholder {
                color: rgba(255, 255, 255, 0.25);
            }
        """)
        self.search_input.setFont(QFont("Segoe UI", 14))
        self.search_input.returnPressed.connect(self._on_submit)
        search_row.addWidget(self.search_input, 1)

        # Settings button
        self.settings_btn = QPushButton("⚙")
        self.settings_btn.setFixedSize(32, 32)
        self.settings_btn.setCursor(QCursor(Qt.PointingHandCursor))
        self.settings_btn.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: rgba(255, 255, 255, 0.4);
                border: none;
                border-radius: 16px;
                font-size: 16px;
            }
            QPushButton:hover {
                color: #38bdf8;
                background: rgba(56, 189, 248, 0.1);
            }
        """)
        self.settings_btn.clicked.connect(self._open_settings)
        search_row.addWidget(self.settings_btn)

        # Close/minimize button
        self.close_btn = QPushButton("✕")
        self.close_btn.setFixedSize(32, 32)
        self.close_btn.setCursor(QCursor(Qt.PointingHandCursor))
        self.close_btn.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: rgba(255, 255, 255, 0.4);
                border: none;
                border-radius: 16px;
                font-size: 14px;
            }
            QPushButton:hover {
                color: #ff4a4a;
                background: rgba(255, 74, 74, 0.15);
            }
        """)
        self.close_btn.clicked.connect(self._hide_to_tray)
        search_row.addWidget(self.close_btn)

        container_layout.addLayout(search_row)

        # ── Separator ──
        self.separator = QFrame()
        self.separator.setFrameShape(QFrame.HLine)
        self.separator.setStyleSheet("""
            background: rgba(255, 255, 255, 0.08);
            max-height: 1px;
            margin-top: 4px;
            margin-bottom: 4px;
        """)
        self.separator.setVisible(False)
        container_layout.addWidget(self.separator)

        # ── Response Area ──
        self.response_area = QTextEdit()
        self.response_area.setReadOnly(True)
        self.response_area.setVisible(False)
        self.response_area.setStyleSheet("""
            QTextEdit {
                background: transparent;
                border: none;
                color: #e0e0e0;
                font-size: 20px;
                font-family: 'Segoe UI', system-ui, sans-serif;
                line-height: 1.8;
                padding: 12px 6px;
                selection-background-color: rgba(56, 189, 248, 0.3);
            }
            QScrollBar:vertical {
                background: transparent;
                width: 4px;
                margin: 4px 0;
            }
            QScrollBar::handle:vertical {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 2px;
                min-height: 30px;
            }
            QScrollBar::handle:vertical:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0;
            }
        """)
        self.response_area.setFont(QFont("Segoe UI", 12))
        container_layout.addWidget(self.response_area, 1)

        # ── Footer ──
        self.footer = QLabel()
        self.footer.setVisible(False)
        self.footer.setStyleSheet("""
            color: rgba(255, 255, 255, 0.3);
            font-size: 11px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            padding: 4px 4px 0 0;
        """)
        self.footer.setAlignment(Qt.AlignRight)
        container_layout.addWidget(self.footer)

    def _init_tray(self):
        """Initialize system tray icon."""
        self.tray_icon = QSystemTrayIcon(self)
        # Use a built-in icon
        icon = QApplication.style().standardIcon(
            QApplication.style().SP_MessageBoxQuestion
        )
        self.tray_icon.setIcon(icon)
        self.tray_icon.setToolTip("AI Search Bar")

        tray_menu = QMenu()

        show_action = QAction("🔍 Show Search Bar", self)
        show_action.triggered.connect(self._show_bar)
        tray_menu.addAction(show_action)

        settings_action = QAction("⚙️ Settings", self)
        settings_action.triggered.connect(self._open_settings)
        tray_menu.addAction(settings_action)

        tray_menu.addSeparator()

        quit_action = QAction("❌ Quit", self)
        quit_action.triggered.connect(QApplication.quit)
        tray_menu.addAction(quit_action)

        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.activated.connect(self._tray_activated)
        self.tray_icon.show()

    def _position_window(self):
        """Position the window at the top center of the screen."""
        screen = QDesktopWidget().availableGeometry()
        x = (screen.width() - self._bar_width) // 2
        y = self.config.get("position_y", 20)
        self.move(x, y)

    # ── Events ───────────────────────────────────────────────────────────────

    def mousePressEvent(self, event):
        """Allow dragging the window."""
        if event.button() == Qt.LeftButton:
            self._drag_position = event.globalPos() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        """Handle window dragging."""
        if event.buttons() == Qt.LeftButton and self._drag_position:
            self.move(event.globalPos() - self._drag_position)
            event.accept()

    def mouseReleaseEvent(self, event):
        """Reset drag position."""
        self._drag_position = None

    def keyPressEvent(self, event):
        """Handle key events."""
        if event.key() == Qt.Key_Escape:
            if self._is_expanded:
                self._collapse()
            else:
                self._hide_to_tray()

    # ── Actions ──────────────────────────────────────────────────────────────

    def _on_submit(self):
        """Handle search submission."""
        query = self.search_input.text().strip()
        if not query:
            return

        api_key = get_api_key()
        if not api_key:
            self._open_settings()
            return

        self._is_loading = True
        self._expand()
        self.response_area.setText("")
        self._loading_dots = 0
        self._loading_timer.start(400)
        self.search_input.setEnabled(False)

        # Make API call in background thread
        thread = threading.Thread(target=self._fetch_response, args=(query,), daemon=True)
        thread.start()

    def _fetch_response(self, query):
        """Fetch response from Gemini in background thread."""
        try:
            if not self.ai._configured:
                self.ai.configure()
            response = self.ai.ask(query)
            self.bridge.response_ready.emit(response)
        except Exception as e:
            self.bridge.response_ready.emit(f"⚠️ Error: {str(e)}")

    def _display_response(self, response):
        """Display the response in the UI (called from main thread via signal)."""
        self._is_loading = False
        self._loading_timer.stop()
        self.response_area.setText(response)
        self.footer.setText("Powered by Gemini ✦")
        self.footer.setVisible(True)
        self.search_input.setEnabled(True)
        self.search_input.setFocus()

    def _update_loading(self, text):
        """Update loading text."""
        self.response_area.setText(text)

    def _animate_loading_dots(self):
        """Animate loading dots."""
        self._loading_dots = (self._loading_dots + 1) % 4
        dots = "●" * self._loading_dots + "○" * (3 - self._loading_dots)
        self.response_area.setText(f"  Thinking {dots}")

    # ── Expand / Collapse ────────────────────────────────────────────────────

    def _expand(self):
        """Expand the search bar to show response."""
        if self._is_expanded:
            return
        self._is_expanded = True

        self.separator.setVisible(True)
        self.response_area.setVisible(True)
        self.footer.setVisible(True)

        self._animate_height(self._collapsed_height, self._expanded_height)

    def _collapse(self):
        """Collapse back to search bar only."""
        if not self._is_expanded:
            return
        self._is_expanded = False
        self._is_loading = False
        self._loading_timer.stop()

        self.separator.setVisible(False)
        self.response_area.setVisible(False)
        self.footer.setVisible(False)
        self.search_input.setEnabled(True)

        self._animate_height(self._expanded_height, self._collapsed_height)
        self.search_input.clear()
        self.search_input.setFocus()

    def _animate_height(self, from_h, to_h):
        """Smoothly animate the height change."""
        self.anim = QPropertyAnimation(self, b"windowHeight")
        self.anim.setDuration(300)
        self.anim.setStartValue(from_h)
        self.anim.setEndValue(to_h)
        self.anim.setEasingCurve(QEasingCurve.OutCubic)
        self.anim.start()

    @pyqtProperty(int)
    def windowHeight(self):
        return self.height()

    @windowHeight.setter
    def windowHeight(self, h):
        self.setFixedHeight(h)

    # ── Tray Methods ─────────────────────────────────────────────────────────

    def _hide_to_tray(self):
        """Hide the window to system tray."""
        self.hide()

    def _show_bar(self):
        """Show the search bar."""
        if self._is_expanded:
            self._collapse()
        self.show()
        self.activateWindow()
        self.raise_()
        self.search_input.setFocus()
        self.search_input.selectAll()

    def _toggle_visibility(self):
        """Toggle the search bar visibility."""
        if self.isVisible():
            self._hide_to_tray()
        else:
            self._show_bar()

    def _tray_activated(self, reason):
        """Handle tray icon activation."""
        if reason == QSystemTrayIcon.Trigger:
            self._toggle_visibility()

    def _open_settings(self):
        """Open settings dialog."""
        dialog = SettingsDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            # Reconfigure Gemini with new key
            try:
                self.ai.configure()
            except ValueError:
                pass



