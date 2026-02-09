import requests
import json

# Test the AI endpoint
url = "http://localhost:8000/api/ai/generate"

payload = {
    "prompt": """Analyze this Python code:

list1 = list(map(int,input().split()))
hash1 = {}
for i in list1:
    hash1[i] = hash1.get(i, 0) + 1
print(hash1)

Provide suggestions for optimization and best practices."""
}

print("Testing AI endpoint...")
print("-" * 50)

try:
    response = requests.post(url, json=payload, timeout=30)
    print(f"Status Code: {response.status_code}")
    print("-" * 50)
    
    if response.status_code == 200:
        result = response.json()
        print("Success:", result.get('success'))
        print("-" * 50)
        print("AI Response:")
        print(result.get('response'))
    else:
        print("Error:", response.text)
        
except Exception as e:
    print(f"Error: {e}")
