Asisten Koding
-
Serve as a product of Research and Development (RnD) in Litapdimas Research of State Islamic Institute of Curup, Bengkulu, Indonesia. This project demonstrates a  qualitative coding workspace with linguistics model embedded. 

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
