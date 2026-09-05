import requests

payload = {
    "query": "We need to procure ordinary Portland cement for construction of government school buildings. The cement should be suitable for structural concrete, masonry, plastering and general building construction, and should comply with the applicable Indian Standards and BIS certification requirements.",
    "input_type": "product_description",
    "language": "auto",
    "enable_bis_discovery": False
}

try:
    response = requests.post("http://localhost:8000/api/analyze", json=payload)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    print(response.json())
except Exception as e:
    print(f"Error: {e}")
