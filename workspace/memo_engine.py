import json
from pathlib import Path
from datetime import datetime


class MemoEngine:
    def __init__(self, storage_dir="data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _session_dir(self, session_id):
        session_dir = self.storage_dir / 'sessions' / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        return session_dir

    def _file_for(self, session_id, doc_id):
        return self._session_dir(session_id) / f"memos_{doc_id}.json"

    def add_memo(self, session_id, doc_id, author, text):
        path = self._file_for(session_id, doc_id)
        items = []
        if path.exists():
            items = json.loads(path.read_text(encoding='utf-8'))
        entry = {"author": author, "text": text, "created": datetime.utcnow().isoformat()}
        items.append(entry)
        path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
        return entry

    def list_memos(self, session_id, doc_id):
        path = self._file_for(session_id, doc_id)
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding='utf-8'))
