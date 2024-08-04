const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const moment = require('moment');

const app = express();
const port = 3001;

// Middleware to parse JSON
app.use(express.json());

// Set up storage using multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const uploadDir = path.join(__dirname, 'tmp', timestamp);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Serve the HTML file
app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle file uploads
app.post('/upload', upload.fields([{ name: 'codeFile' }, { name: 'postmanFile' }]), (req, res) => {
  console.log('Received file upload request');
  if (!req.files) {
    console.log('No files uploaded');
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const codeFile = req.files['codeFile'] ? req.files['codeFile'][0].originalname : 'No file';
  const postmanFile = req.files['postmanFile'] ? req.files['postmanFile'][0].originalname : 'No file';

  console.log(`Uploaded files - Code: ${codeFile}, Postman: ${postmanFile}`);

  // Process the files (this is just a dummy example)
  // Replace this with your actual processing logic
  const result = [
    { filename: codeFile, status: 'processed' },
    { filename: postmanFile, status: 'processed' }
  ];

  console.log('File processing completed');
  res.json(result);
});

// Handle security input submission
app.post('/security', (req, res) => {
  const { securityInput } = req.body;
  console.log(`Received security input: ${securityInput}`);

  // Trigger the Python script and pass the URL
  const pythonExecutable = '/usr/bin/python3';
  console.log(`Executing Python script: ${pythonExecutable} zaptesting.py "${securityInput}"`);

  exec(`"${pythonExecutable}" zaptesting.py "${securityInput}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return res.status(500).json({ error: 'Failed to execute zaptesting.py' });
    }

    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);

    // Parse the JSON output from the Python script
    let jsonOutput;
    try {
      jsonOutput = JSON.parse(stdout);
      console.log('Parsed JSON output from Python script');
    } catch (e) {
      console.error('Failed to parse JSON output from zaptesting.py');
      return res.status(500).json({ error: 'Failed to parse JSON output from zaptesting.py' });
    }

    // Send the JSON output back to the client
    res.json(jsonOutput);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
