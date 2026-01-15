// Simple HTTP server for local development
// Run with: node server.js
// Then open: http://localhost:8000

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.patt': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json'
};

const server = http.createServer((req, res) => {
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 - File Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`, 'utf-8');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log('Press Ctrl+C to stop the server');
  
  // Automatically open Chrome in incognito mode
  const url = `http://localhost:${PORT}/`;
  const { exec } = require('child_process');
  const platform = process.platform;
  
  let command;
  if (platform === 'win32') {
    // Windows: Use start command with Chrome incognito
    command = `start chrome --incognito "${url}"`;
  } else if (platform === 'darwin') {
    // macOS: Use open command with Chrome incognito
    command = `open -na "Google Chrome" --args --incognito "${url}"`;
  } else {
    // Linux: Use google-chrome or chromium
    command = `google-chrome --incognito "${url}" || chromium --incognito "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(`Could not automatically open Chrome incognito. Please manually open: ${url}`);
      console.log(`Error: ${error.message}`);
    } else {
      console.log(`Opening Chrome in incognito mode at ${url}`);
    }
  });
});
