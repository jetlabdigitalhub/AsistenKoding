class CodingModule:
    def __init__(self):
        self.name = "Process"
        self.terminology = ["step", "actor", "sequence"]
        self.semantic_templates = {"process_step": "{actor} -> {action} -> {outcome}"}
        self.keyword_patterns = [r"\b(do|make|create|decide|act|implement)\b"]
        self.export_prefs = {"highlight_color": "#e8d6ff", "include_steps_table": True}

    def suggest(self, text):
        low = text.lower()
        suggestions = []
        if any(k in low for k in ["then","after","before","next"]):
            suggestions.append('Sequence')
        suggestions.extend(['Action', 'Decision', 'Outcome'])
        return suggestions

    def analyze(self, text):
        verbs = [w for w in ["do","make","create","decide","act","implement"] if w in text.lower()]
        return {"suggestions": self.suggest(text), "actions_found": verbs}
