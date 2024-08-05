const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { jsonrepair } = require('jsonrepair');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    } else {
      // Clean up the uploads folder
      fs.readdirSync(uploadDir).forEach((file) => {
        fs.unlinkSync(path.join(uploadDir, file));
      });
      console.log('Cleaned up uploads folder');
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post('/general-testing', upload.fields([{ name: 'codeUpload' }, { name: 'collectionUpload' }]), (req, res) => {
  console.log('Files uploaded:', req.files);

  const codePath = req.files['codeUpload'] ? req.files['codeUpload'][0].path : null;
  const collectionPath = req.files['collectionUpload'] ? req.files['collectionUpload'][0].path : null;

  if (!codePath || !collectionPath) {
    return res.status(400).json({ error: 'Both code and collection files are required.' });
  }

  const step = req.query.step || 'analyze';
  const pythonProcess = spawn('/usr/bin/python3', ['process_files.py', step, codePath, collectionPath]);

  let pyOutput = '';
  pythonProcess.stdout.on('data', (data) => {
    pyOutput += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error('Python script error output:', data.toString());
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('Error executing process_files.py:', code);
      return res.status(500).json({ error: 'Failed to execute process_files.py' });
    }

    console.log('Python script completed with code:', code);
    console.log('Python script output:', pyOutput);

    try {
      // Clean the output by removing markdown code block delimiters and extra spaces
      let cleanedOutput = pyOutput.replace(/```json/g, '').replace(/```/g, '').trim();

      // Use jsonrepair to fix the JSON
      const repairedOutput = jsonrepair(cleanedOutput);
      const result = JSON.parse(repairedOutput);
      res.json(result);
    } catch (e) {
      console.error('Failed to parse JSON output from process_files.py:', e);
      return res.status(500).json({ error: 'Failed to parse JSON output from process_files.py' });
    }
  });
});

module.exports = router;
