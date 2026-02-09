import requests
import json

# Test the AI endpoint with an error
url = "http://localhost:8000/api/ai/generate"

# Test 1: Missing colon error
print("=" * 60)
print("TEST 1: Missing Colon Error")
print("=" * 60)

payload1 = {
    "prompt": """A python code execution resulted in this error:

Error: SyntaxError: invalid syntax

Code:
```python
for i in range(5)
    print(i)
```

Provide the corrected code."""
}

response1 = requests.post(url, json=payload1, timeout=10)
print(response1.json()['response'])

print("\n" + "=" * 60)
print("TEST 2: Indentation Error")
print("=" * 60)

# Test 2: Indentation error
payload2 = {
    "prompt": """A python code execution resulted in this error:

Error: IndentationError: expected an indented block

Code:
```python
if x > 5:
print("Greater")
```

Provide the corrected code."""
}

response2 = requests.post(url, json=payload2, timeout=10)
print(response2.json()['response'])

print("\n" + "=" * 60)
print("TEST 3: Successful Code (Suggestions)")
print("=" * 60)

# Test 3: Successful code
payload3 = {
    "prompt": """Analyze this python code:

```python
list1 = list(map(int,input().split()))
hash1 = {}
for i in list1:
    hash1[i] = hash1.get(i, 0) + 1
print(hash1)
```

Provide suggestions for optimization and best practices."""
}

response3 = requests.post(url, json=payload3, timeout=10)
print(response3.json()['response'])
