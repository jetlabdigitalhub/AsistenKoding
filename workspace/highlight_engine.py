import json
from pathlib import Path
import uuid
from datetime import datetime


class HighlightEngine:
    def __init__(self, storage_dir="data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _file_for(self, doc_id):
        return self.storage_dir / f"highlights_{doc_id}.json"

    def save_highlight(self, doc_id, start, end, text, label, module, **kwargs):
        path = self._file_for(doc_id)
        items = []
        if path.exists():
            items = json.loads(path.read_text(encoding='utf-8'))
        entry = {
            "id": str(uuid.uuid4()),
            "text": text,
            "start": int(start) if start is not None else None,
            "end": int(end) if end is not None else None,
            "code": label or "",
            "module": module or "",
            "cycle": "first",
            "memo": "",
            "created": datetime.utcnow().isoformat()
        }
        # merge any extra metadata (paragraph, line, etc.)
        for k,v in kwargs.items():
            entry[k] = v
        items.append(entry)
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
        return entry

    def update_highlight(self, doc_id, highlight_id, **kwargs):
        path = self._file_for(doc_id)
        if not path.exists():
            return None
        items = json.loads(path.read_text(encoding='utf-8'))
        for it in items:
            if it.get('id') == highlight_id:
                it.update(kwargs)
                path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
                return it
        return None

    def get_highlight(self, doc_id, highlight_id):
        path = self._file_for(doc_id)
        if not path.exists():
            return None
        items = json.loads(path.read_text(encoding='utf-8'))
        for it in items:
            if it.get('id') == highlight_id:
                return it
        return None

    def delete_highlight(self, doc_id, highlight_id):
        path = self._file_for(doc_id)
        if not path.exists():
            return False
        items = json.loads(path.read_text(encoding='utf-8'))
        new = [it for it in items if it.get('id') != highlight_id]
        path.write_text(json.dumps(new, ensure_ascii=False, indent=2), encoding='utf-8')
        return True

    def list_highlights(self, doc_id):
        path = self._file_for(doc_id)
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding='utf-8'))

    def clear_highlights(self, doc_id):
        path = self._file_for(doc_id)
        if path.exists():
            path.unlink()
        return []
