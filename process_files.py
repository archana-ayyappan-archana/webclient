import google.generativeai as genai
import json
import sys
from pathlib import Path
import re

# Initialize Gemini API (replace with your actual key)
genai.configure(api_key="AIzaSyBzP2xWPUPw0SNEuzVez3onXYXJbuEgKIo")

def analyze_code_for_security_issues(code):
    model = genai.GenerativeModel('gemini-1.5-flash')

    try:
        prompt = (
            f"Analyze the following code for security issues and list possible issue areas and associated vulnerabilities:\n\n"
            f"Code:\n{code}\n\n"
        )
        response = model.generate_content(prompt)
        return response.text
    except (KeyError, ValueError, Exception) as e:
        print(f"Error analyzing code: {e}", file=sys.stderr)
        return 'Error analyzing code'

def generate_test_cases(code, postman_collection):
    model = genai.GenerativeModel('gemini-1.5-flash')

    try:
        prompt = (
            f"Based on the following code and Postman collection, generate a range of test cases in JSON format for this website. "
            f"Include testcase description, URL, body, and bearer token (set true if required) in JSON format. "
            f"Please provide the output directly in JSON format without any markdown formatting:\n\n"
            f"Code:\n{code}\n\n"
            f"Postman Collection:\n{postman_collection}\n\n"
        )
        response = model.generate_content(prompt)
        response_text = response.text
        print(response_text)
        
        # Extract JSON from the response using regex
        json_match = re.search(r'(\[\s*\{.*?\}\s*\])', response_text, re.DOTALL)
        if json_match:
            json_content = json_match.group(1)
            return json.loads(json_content)
        else:
            # If JSON is not found using regex, try to find any JSON-like structure
            json_match_fallback = re.search(r'(\{.*\}|\[.*\])', response_text, re.DOTALL)
            if json_match_fallback:
                json_content_fallback = json_match_fallback.group(1)
                return json.loads(json_content_fallback)
            else:
                raise ValueError("No JSON content found in the response")
    except (KeyError, ValueError, Exception) as e:
        print(f"Error generating test cases: {e}", file=sys.stderr)
        return []

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: python process_files.py <step> <code_file> <postman_collection_file>"}))
        sys.exit(1)

    step = sys.argv[1]
    code_file = sys.argv[2]
    postman_collection_file = sys.argv[3]

    code = Path(code_file).read_text()
    postman_collection = Path(postman_collection_file).read_text()

    if step == "analyze":
        security_analysis = analyze_code_for_security_issues(code)
        result = {"security_analysis": security_analysis}
        print(json.dumps(result, indent=4))

    elif step == "generate_tests":
        test_cases = generate_test_cases(code, postman_collection)
        result = {"test_cases": test_cases}
        print(json.dumps(result, indent=4))

    else:
        print(json.dumps({"error": "Invalid step. Use 'analyze' or 'generate_tests'"}))
        sys.exit(1)