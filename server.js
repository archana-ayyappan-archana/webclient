const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const generalTestingRouter = require('./generalTesting'); // Adjusted path

const app = express();
const port = 3070;

// Middleware to parse JSON
app.use(express.json());
app.use(express.static('public'));

// Serve the HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/general.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'general.html'));
});
app.get('/security.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'security.html'));
});
app.get('/gemini.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'gemini.html'));
});

// Use the general testing router
app.use('/', generalTestingRouter);

// Handle security input submission
app.post('/security', (req, res) => {
  const { securityInput } = req.body;
  console.log('Received security input:', securityInput);

  // Trigger the ZAP testing script
  const zapExecutable = '/usr/bin/python3'; // Ensure this is correct for your environment
  console.log(`Executing ZAP testing script: ${zapExecutable} zaptesting.py "${securityInput}"`);

  const zapProcess = spawn(zapExecutable, ['zaptesting.py', securityInput]);

  let zapOutput = '';
  let zapError = '';

  zapProcess.stdout.on('data', (data) => {
    zapOutput += data.toString();
    console.log('ZAP testing script output:', data.toString());
  });

  zapProcess.stderr.on('data', (data) => {
    zapError += data.toString();
    console.error('ZAP testing script error output:', data.toString());
  });

  zapProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('Error executing zaptesting.py:', zapError);
      return res.status(500).json({ error: 'Failed to execute zaptesting.py' });
    }

    console.log('ZAP testing script completed with code:', code);
    console.log('ZAP testing script stdout:', zapOutput);

    let vulnerabilities;
    try {
      vulnerabilities = JSON.parse(zapOutput);
      console.log('Parsed vulnerabilities:', vulnerabilities);

      // Save the results to the latest-sectest folder
      const resultDir = path.join(__dirname, 'latest-sectest');
      if (!fs.existsSync(resultDir)) {
        fs.mkdirSync(resultDir, { recursive: true });
      }
      const resultFilePath = path.join(resultDir, 'zap_results.json');
      fs.writeFileSync(resultFilePath, JSON.stringify(vulnerabilities, null, 2));

      console.log('Results saved to:', resultFilePath);
      res.json({ vulnerabilities, resultFilePath });
    } catch (e) {
      console.error('Failed to parse JSON output from zaptesting.py:', e);
      return res.status(500).json({ error: 'Failed to parse JSON output from zaptesting.py' });
    }
  });
});

// Handle Gemini suggestions
app.post('/gemini', async (req, res) => {
  console.log('Received request for Gemini suggestions');

  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 5;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Clean up the latest-gem-suggestions folder
  const geminiDir = path.join(__dirname, 'latest-gem-suggestions');
  if (fs.existsSync(geminiDir)) {
    fs.readdirSync(geminiDir).forEach((file) => {
      fs.unlinkSync(path.join(geminiDir, file));
    });
    console.log('Cleaned up latest-gem-suggestions folder');
  } else {
    fs.mkdirSync(geminiDir, { recursive: true });
    console.log('Created latest-gem-suggestions folder');
  }

  // Read vulnerabilities from the latest-sectest folder
  const zapResultsFile = path.join(__dirname, 'latest-sectest', 'zap_results.json');
  let vulnerabilities;
  try {
    vulnerabilities = JSON.parse(fs.readFileSync(zapResultsFile, 'utf-8'));
    console.log('Read vulnerabilities from zap_results.json:', vulnerabilities);
  } catch (error) {
    console.error('Error reading zap results:', error.message);
    return res.status(500).json({ error: `Error reading zap results: ${error.message}` });
  }

  const vulnerabilitiesToProcess = vulnerabilities.slice(startIndex, endIndex);

  const pythonProcess = spawn('/usr/bin/python3', ['get_gemini_suggestions.py'], { stdio: ['pipe', 'pipe', 'pipe'] });

  pythonProcess.stdin.write(JSON.stringify(vulnerabilitiesToProcess));
  pythonProcess.stdin.end();

  let pyOutput = '';
  pythonProcess.stdout.on('data', (data) => {
    pyOutput += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('Python script error output:', data.toString());
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('Error executing get_gemini_suggestions.py:', code);
      return res.status(500).json({ error: 'Failed to execute get_gemini_suggestions.py' });
    }

    console.log('Python script completed with code:', code);
    console.log('Python script output:', pyOutput);

    try {
      const suggestions = JSON.parse(pyOutput);
      res.json(suggestions);
    } catch (e) {
      console.error('Failed to parse JSON output from get_gemini_suggestions.py:', e);
      return res.status(500).json({ error: 'Failed to parse JSON output from get_gemini_suggestions.py' });
    }
  });
});

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Process interrupted');
  });
});
