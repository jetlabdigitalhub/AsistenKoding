# Qualitative Coding Workspace (Modular)

This project demonstrates a modular qualitative coding workspace with one reusable engine and multiple coding modules.

Run:

1. Create a Python environment and install dependencies:

```bash
pip install -r requirements.txt
```

2. Start the server:

```bash
python app.py
```

3. Open http://localhost:5000

Architecture:
- `workspace/` engines (highlight, memo, export, semantic loader)
- `modules/` coding modules implementing `CodingModule` class with `analyze()` and `suggest()`
- `frontend/` minimal UI that dynamically loads modules
