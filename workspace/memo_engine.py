import json
from pathlib import Path
from datetime import datetime


class MemoEngine:
    def __init__(self, storage_dir="data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _file_for(self, doc_id):
        return self.storage_dir / f"memos_{doc_id}.json"

    def add_memo(self, doc_id, author, text):
        path = self._file_for(doc_id)
        items = []
        if path.exists():
            items = json.loads(path.read_text(encoding='utf-8'))
        entry = {"author": author, "text": text, "created": datetime.utcnow().isoformat()}
        items.append(entry)
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
        return entry

    def list_memos(self, doc_id):
        path = self._file_for(doc_id)
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding='utf-8'))
