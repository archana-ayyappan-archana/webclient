import sys
from zapv2 import ZAPv2
import time
import json
import logging

# Configuration
API_KEY = "vntekaje3msasjdga0ohug6ugk"
TARGET_URL = sys.argv[1]  # Get the URL from the command line argument
ZAP_PROXY = "http://localhost:8080"

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize OWASP ZAP
zap = ZAPv2(apikey=API_KEY, proxies={'http': ZAP_PROXY, 'https': ZAP_PROXY})

# Helper function to handle API requests and exceptions
def zap_request(func, *args, **kwargs):
    try:
        response = func(*args, **kwargs)
        logging.info(f"Response from {func.__name__}: {response}")
        time.sleep(2)  # Adding delay to avoid overwhelming ZAP with requests
        return response
    except Exception as e:
        logging.error(f"Error during ZAP API request: {e}")
        return None

# Start a new session
logging.info("Starting new session...")
zap_request(zap.core.new_session, name="Test Session", overwrite=True)

# Access the target URL to initiate a scan
logging.info("Accessing target URL...")
zap_request(zap.urlopen, TARGET_URL)

# Spider the target
logging.info("Starting spider scan...")
spider_scan_id = zap_request(zap.spider.scan, TARGET_URL)

# Wait for the spider scan to complete
logging.info("Waiting for spider scan to complete...")
while True:
    status = zap_request(zap.spider.status, spider_scan_id)
    if status is None or int(status) >= 100:
        break
    logging.info(f"Spider scan progress: {status}%")
    time.sleep(5)

# Perform an active scan
logging.info("Starting active scan...")
active_scan_id = zap_request(zap.ascan.scan, TARGET_URL)

# Wait for the active scan to complete
logging.info("Waiting for active scan to complete...")
while True:
    status = zap_request(zap.ascan.status, active_scan_id)
    if status is None or int(status) >= 100:
        break
    logging.info(f"Active scan progress: {status}%")
    time.sleep(5)

# Retrieve and print the scan results
logging.info("Retrieving scan results...")
vulnerabilities = zap_request(zap.core.alerts, baseurl=TARGET_URL)

if vulnerabilities:
    logging.info("Saving vulnerabilities to 'zap_vulnerabilities.json'...")
    with open("zap_vulnerabilities.json", "w") as file:
        json.dump(vulnerabilities, file, indent=4)
    logging.info("Vulnerabilities saved successfully.")
else:
    logging.info("No vulnerabilities found.")

# Output results to stdout
print(json.dumps(vulnerabilities, indent=4))
