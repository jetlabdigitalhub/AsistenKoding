class CodingModule:
    def __init__(self):
        self.name = "Narrative"
        self.terminology = ["story", "sequence", "turning_point"]
        self.semantic_templates = {"story_arc": ["setup","complication","resolution"]}
        self.keyword_patterns = [r"\b(before|after|then|when|because)\b"]
        self.export_prefs = {"highlight_color": "#cfefff", "include_story_arc": True}

    def suggest(self, text):
        # simple rules: suggest narrative elements when temporal/connective words present
        low = text.lower()
        suggestions = []
        if any(k in low for k in ["then","after","before","when"]):
            suggestions.extend(["Event","Sequence"])
        suggestions.extend(["Setting", "Consequence"])
        return suggestions

    def analyze(self, text):
        sentences = [s.strip() for s in text.split('.') if s.strip()]
        return {"suggestions": self.suggest(text), "sentence_count": len(sentences)}
