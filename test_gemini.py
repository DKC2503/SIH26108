import json
from backend.ai.gemini_client import parse_requirement

test_query = "Our department is procuring 50 kg bags of cement for constructing a new government hospital building. The cement will be used for reinforced concrete foundations, columns, beams and slabs."

print("Running Gemini parser...")
req = parse_requirement(test_query)
print(json.dumps(req, indent=2))
