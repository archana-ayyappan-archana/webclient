import sys
from zapv2 import ZAPv2
import time
import json
import logging

# Configuration
API_KEY = "vntekaje3msasjdga0ohug6ugk"
TARGET_URL = sys.argv[1]  # Get the URL from the command line argument

# Initialize logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize OWASP ZAP
zap = ZAPv2(apikey=API_KEY)

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
if not zap_request(zap.core.new_session, name="Test Session", overwrite=True):
    logging.error("Failed to start a new session.")
    exit(1)

# Access the target URL to initiate a scan
logging.info("Accessing target URL...")
if not zap_request(zap.urlopen, TARGET_URL):
    logging.error("Failed to access the target URL.")
    exit(1)

# Spider the target
logging.info("Starting spider scan...")
spider_scan_id = zap_request(zap.spider.scan, TARGET_URL)
if not spider_scan_id:
    logging.error("Spider scan did not start properly.")
    exit(1)

# Wait for the spider scan to complete
logging.info("Waiting for spider scan to complete...")
while True:
    status = zap_request(zap.spider.status, spider_scan_id)
    if status is None:
        logging.error("Failed to get spider scan status.")
        exit(1)
    if int(status) >= 100:
        break
    logging.info(f"Spider scan progress: {status}%")
    time.sleep(5)

# Perform an active scan
logging.info("Starting active scan...")
active_scan_id = zap_request(zap.ascan.scan, TARGET_URL)
if not active_scan_id:
    logging.error("Active scan did not start properly.")
    exit(1)

# Wait for the active scan to complete
logging.info("Waiting for active scan to complete...")
while True:
    status = zap_request(zap.ascan.status, active_scan_id)
    if status is None:
        logging.error("Failed to get active scan status.")
        exit(1)
    try:
        if int(status) >= 100:
            break
    except ValueError:
        logging.error(f"Unexpected status value: {status}")
        exit(1)
    logging.info(f"Active scan progress: {status}%")
    time.sleep(5)

# Run additional attacks
def run_additional_attacks():
    attack_types = [
        ("AJAX Spider scan", zap.ajaxSpider.scan, zap.ajaxSpider.status),
        ("SQL Injection scan", zap.ascan.scan, zap.ascan.status),
        ("XSS scan", zap.ascan.scan, zap.ascan.status),
        ("Command Injection scan", zap.ascan.scan, zap.ascan.status),
        ("Directory Browsing scan", zap.ascan.scan, zap.ascan.status),
        ("Remote File Inclusion scan", zap.ascan.scan, zap.ascan.status),
        ("CSRF scan", zap.ascan.scan, zap.ascan.status),
        ("Path Traversal scan", zap.ascan.scan, zap.ascan.status),
        ("Server-Side Include scan", zap.ascan.scan, zap.ascan.status),
        ("XXE scan", zap.ascan.scan, zap.ascan.status),
        ("HTTP Parameter Pollution scan", zap.ascan.scan, zap.ascan.status),
        ("Local File Inclusion scan", zap.ascan.scan, zap.ascan.status),
        ("Remote Code Execution scan", zap.ascan.scan, zap.ascan.status),
    ]

    for attack_name, scan_func, status_func in attack_types:
        logging.info(f"Starting {attack_name}...")
        scan_id = zap_request(scan_func, TARGET_URL)
        if scan_id:
            while True:
                status = zap_request(status_func, scan_id)
                if status is None:
                    logging.error(f"Failed to get status for {attack_name}.")
                    return
                try:
                    if int(status) >= 100:
                        break
                except ValueError:
                    logging.error(f"Unexpected status value for {attack_name}: {status}")
                    return
                logging.info(f"{attack_name} progress: {status}%")
                time.sleep(5)
            logging.info(f"{attack_name} completed.")
        else:
            logging.error(f"{attack_name} did not start properly.")

run_additional_attacks()

# Retrieve and print the scan results
logging.info("Retrieving scan results...")
vulnerabilities = zap_request(zap.core.alerts)
if vulnerabilities is None:
    logging.error("Failed to retrieve scan results.")
    exit(1)

if vulnerabilities:
    logging.info("Saving vulnerabilities to 'zap_vulnerabilities.json'...")
    try:
        with open("zap_vulnerabilities.json", "w") as file:
            json.dump(vulnerabilities, file, indent=4)
        logging.info("Vulnerabilities saved successfully.")
        # Print the results to stdout as JSON
        print(json.dumps(vulnerabilities))
    except Exception as e:
        logging.error(f"Failed to save vulnerabilities to file: {e}")
else:
    logging.info("No vulnerabilities found.")
    print(json.dumps({"message": "No vulnerabilities found."}))
