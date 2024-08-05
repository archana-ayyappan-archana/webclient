import google.generativeai as genai
import json
import re
import sys

# Initialize Gemini API (replace with your actual key)
genai.configure(api_key="AIzaSyBzP2xWPUPw0SNEuzVez3onXYXJbuEgKIo")

def get_gemini_suggestions(vulnerability_name):
    model = genai.GenerativeModel('gemini-1.5-flash')

    try:
        prompt = (
            f"Provide detailed suggestions and code samples to fix the following vulnerability:\n\n"
            f"Vulnerability Name: {vulnerability_name}\n\n"
            f"Please provide actionable suggestions and relevant code samples to address this issue in the following format:\n\n"
            f"Suggestions: <detailed suggestions here>\n\n"
            f"Code Samples: <code samples here>"
        )
        response = model.generate_content(prompt)
        suggestion = extract_suggestions(response.text)
        return {'name': vulnerability_name, **suggestion}
    except (KeyError, ValueError, Exception) as e:
        print(f"Error processing vulnerability: {e}", file=sys.stderr)
        return {'name': vulnerability_name, 'suggestions': 'Error processing request', 'codeSamples': ''}

def extract_suggestions(response_text):
    suggestions_pattern = re.compile(r'Suggestions:\s*(.*)', re.IGNORECASE | re.DOTALL)
    code_samples_pattern = re.compile(r'Code Samples:\s*(.*)', re.IGNORECASE | re.DOTALL)

    suggestions_match = suggestions_pattern.search(response_text)
    code_samples_match = code_samples_pattern.search(response_text)

    suggestions = suggestions_match.group(1).strip() if suggestions_match else 'No suggestions found'
    code_samples = code_samples_match.group(1).strip() if code_samples_match else 'No code samples found'

    return {'suggestions': suggestions, 'codeSamples': code_samples}

if __name__ == "__main__":
    try:
        vulnerabilities = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}), file=sys.stderr)
        sys.exit(1)

    results = []
    for vulnerability in vulnerabilities:
        suggestion = get_gemini_suggestions(vulnerability['name'])
        results.append(suggestion)
    print(json.dumps(results, indent=4))
