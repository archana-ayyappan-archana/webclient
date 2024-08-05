const jsonrepair = require('jsonrepair');

try {
  // Use jsonrepair to fix the JSON
  const repairedOutput = jsonrepair(pyOutput);
  const result = JSON.parse(repairedOutput);
  res.json(result);
} catch (e) {
  console.error('Failed to parse JSON output from process_files.py:', e);
  return res.status(500).json({ error: 'Failed to parse JSON output from process_files.py' });
}
