import requests

url = "http://localhost:8000/api/ai/generate"

# Test NameError fix
payload = {
    "prompt": """A python code execution resulted in this error:

Error: NameError: name 'srikar' is not defined

Code:
```python
print(srikar)
```

Provide the corrected code."""
}

print("Testing NameError fix...")
print("=" * 60)

response = requests.post(url, json=payload, timeout=10)
print(f"Status: {response.status_code}")
print("=" * 60)
print(response.json()['response'])
