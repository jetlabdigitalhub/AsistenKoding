class CodingModule:
    def __init__(self):
        self.name = "Descriptive"
        self.terminology = ["attribute", "frequency", "descriptor"]
        self.semantic_templates = {"attribute_table": "{term}: {count}"}
        self.keyword_patterns = [r"\b\w+\b"]
        self.export_prefs = {"highlight_color": "#fff2a8", "include_frequency_table": True}

    def suggest(self, text):
        # simple suggestion logic: propose top frequent terms
        words = [w.strip('.,').lower() for w in text.split()]
        freqs = {}
        for w in words:
            if not w: continue
            freqs[w] = freqs.get(w, 0) + 1
        common = sorted(freqs.items(), key=lambda x: -x[1])[:10]
        return [w for w,c in common]

    def analyze(self, text):
        # return top repeated words and a small descriptor summary
        suggestions = self.suggest(text)
        return {"suggestions": suggestions, "common_terms": suggestions[:10]}
