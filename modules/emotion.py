class CodingModule:
    def __init__(self):
        self.name = "Emotion"
        self.terminology = ["valence", "intensity", "affect"]
        self.semantic_templates = {"affect_relation": "{entity} expresses {emotion} towards {object}"}
        self.keyword_patterns = [r"\b(happy|sad|angry|love|hate|fear|anxious)\b"]
        self.export_prefs = {"highlight_color": "#ffd6d6", "include_polarity": True}

    def suggest(self, text):
        # provide emotion suggestions based on keywords
        low = text.lower()
        suggestions = []
        if any(k in low for k in ["happy","good","love","joy","pleased"]):
            suggestions.append('Positive')
        if any(k in low for k in ["sad","bad","hate","angry","upset","depress"]):
            suggestions.append('Negative')
        if not suggestions:
            suggestions.append('Neutral')
        return suggestions

    def analyze(self, text):
        pos = [w for w in ["good","happy","love","great"] if w in text.lower()]
        neg = [w for w in ["bad","sad","hate","angry"] if w in text.lower()]
        polarity = "Neutral"
        if len(pos) > len(neg):
            polarity = "Positive"
        elif len(neg) > len(pos):
            polarity = "Negative"
        return {"suggestions": self.suggest(text), "polarity": polarity}
