const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Accept', 'Cache-Control', 'Connection', 'Content-Type']
}));

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'Lark MCP SSE Server for Genspark',
    version: '1.0.0',
    endpoints: {
      sse: '/sse',
      direct: '/mcp'
    },
    timestamp: new Date().toISOString()
  });
});

// SSE endpoint cho Genspark
app.get('/sse', (req, res) => {
  console.log('Genspark SSE connection established');
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Initial connection
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    status: 'connected',
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Start lark-mcp process
  const mcpProcess = spawn('node', ['dist/index.js', 'mcp'], {
    env: {
      ...process.env,
      APP_ID: process.env.APP_ID,
      APP_SECRET: process.env.APP_SECRET,
      LARK_DOMAIN: process.env.LARK_DOMAIN || 'https://open.larksuite.com/'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Forward MCP output to SSE
  mcpProcess.stdout.on('data', (data) => {
    const output = data.toString();
    try {
      const jsonData = JSON.parse(output);
      res.write(`data: ${JSON.stringify(jsonData)}\n\n`);
    } catch (e) {
      res.write(`data: ${JSON.stringify({
        type: 'log',
        message: output.trim()
      })}\n\n`);
    }
  });

  mcpProcess.stderr.on('data', (data) => {
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: data.toString().trim()
    })}\n\n`);
  });

  // Cleanup on disconnect
  req.on('close', () => {
    mcpProcess.kill();
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Lark MCP SSE Server running on port ${port}`);
});
