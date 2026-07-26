import importlib.util
import sys
from pathlib import Path


class SemanticEngine:
    def __init__(self, modules_dir=None):
        self.modules_dir = Path(modules_dir or "modules")
        self.modules = {}
        self.load_all()

    def load_all(self):
        self.modules = {}
        if not self.modules_dir.exists():
            return
        for f in self.modules_dir.glob("*.py"):
            if f.name.startswith("__"):
                continue
            name = f.stem
            mod = self._import_module_from_path(name, f)
            if mod and hasattr(mod, "CodingModule"):
                try:
                    inst = mod.CodingModule()
                    self.modules[inst.name] = inst
                except Exception:
                    continue

    def _import_module_from_path(self, name, path):
        spec = importlib.util.spec_from_file_location(name, str(path))
        if spec is None:
            return None
        mod = importlib.util.module_from_spec(spec)
        sys.modules[name] = mod
        spec.loader.exec_module(mod)
        return mod

    def list_modules(self):
        return list(self.modules.keys())

    def get_module(self, name):
        return self.modules.get(name)

    def analyze_with(self, name, text):
        m = self.get_module(name)
        if not m:
            return {}
        # return combined metadata + analysis so workspace can adapt UI/exports
        result = {}
        try:
            analysis = m.analyze(text)
        except Exception:
            analysis = {}
        try:
            suggestions = m.suggest(text)
        except Exception:
            suggestions = []
        result['module'] = {
            'name': getattr(m, 'name', name),
            'terminology': getattr(m, 'terminology', []),
            'semantic_templates': getattr(m, 'semantic_templates', {}),
            'keyword_patterns': getattr(m, 'keyword_patterns', []),
            'export_prefs': getattr(m, 'export_prefs', {}),
        }
        result['suggestions'] = suggestions
        result['analysis'] = analysis
        return result
