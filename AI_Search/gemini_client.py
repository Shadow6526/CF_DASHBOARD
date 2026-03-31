"""
Gemini API Client for AI Search Bar
"""
from google import genai
from config import get_api_key


class GeminiClient:
    """Client to interact with Google Gemini API."""

    def __init__(self):
        self.client = None
        self._configured = False

    def configure(self, api_key=None):
        """Configure the Gemini API with the provided key."""
        key = api_key or get_api_key()
        if not key:
            raise ValueError("Gemini API key not set! Please set it in settings.")

        self.client = genai.Client(api_key=key)
        self._configured = True

    def ask(self, question):
        """
        Send a question to Gemini and get a short answer.
        Returns the response text.
        """
        if not self._configured:
            self.configure()

        if not self.client:
            raise ValueError("Gemini client not initialized. Check your API key.")

        prompt = (
            "You are a AI assistant like Jarvis embedded in a desktop search bar. "
            "Answer the following question in short sentences possible. "
            "Be direct and helpful. If code is needed, keep it minimal. "
            "Do not use markdown formatting heavily altough you can use whereever necessory."
            "Answer in Hinglish Only!!\n\n"
            f"Question is: {question}"
        )

        try:
            # Using the fast new gemini-2.5-flash which is active on their quota limits
            response = self.client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            return f"Error: {str(e)}"
