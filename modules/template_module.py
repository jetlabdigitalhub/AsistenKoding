class CodingModule:
    """Template for new coding modules.

    Implement these properties/methods:
    - name: display name
    - terminology: list of terms
    - semantic_templates: dict for export/interpretation
    - keyword_patterns: list of regex strings
    - export_prefs: dict for export formatting
    - suggest(text): return list of suggested codes/terms
    - analyze(text): return JSON-serializable analysis
    """
    def __init__(self):
        self.name = "Template"
        self.terminology = []
        self.semantic_templates = {}
        self.keyword_patterns = []
        self.export_prefs = {}

    def suggest(self, text):
        return []

    def analyze(self, text):
        return {"suggestions": self.suggest(text)}
