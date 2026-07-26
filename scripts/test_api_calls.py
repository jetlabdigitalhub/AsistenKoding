import json
import urllib.request

url = 'http://127.0.0.1:5000/api/export'
data = {'doc_id':'default','text':'This is a test export from automated script.\nLine2','format':'docx'}
req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req) as resp:
    print('Status:', resp.status)
    print(resp.read().decode())
