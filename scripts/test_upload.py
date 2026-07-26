import requests
url = 'http://127.0.0.1:5000/api/upload_docx'
path = 'd:/Jetlab Project/ASISTEN KODING V 1.6 Alpha b.003/data/export_default.docx'
with open(path, 'rb') as f:
    files = {'file': ('export_default.docx', f, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
    r = requests.post(url, files=files)
    print('Status:', r.status_code)
    try:
        print(r.json())
    except Exception:
        print(r.text)
