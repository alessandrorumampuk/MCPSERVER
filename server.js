const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { MCPContextManager } = require('./contextManager');
const axios = require('axios');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Context Manager
const contextManager = new MCPContextManager();

// REST API endpoints
app.get('/contexts', (req, res) => {
  res.json(contextManager.getAllContexts());
});

app.get('/contexts/:contextId', (req, res) => {
  const context = contextManager.getContext(req.params.contextId);
  if (context) {
    res.json(context);
  } else {
    res.status(404).json({ error: 'Context not found' });
  }
});

app.post('/contexts', (req, res) => {
  const { contextId, data } = req.body;
  if (!contextId) {
    return res.status(400).json({ error: 'Context ID is required' });
  }
  
  const context = contextManager.createContext(contextId, data);
  res.status(201).json(context);
});

app.put('/contexts/:contextId', (req, res) => {
  const { data } = req.body;
  const updated = contextManager.updateContext(req.params.contextId, data);
  
  if (updated) {
    res.json(contextManager.getContext(req.params.contextId));
  } else {
    res.status(404).json({ error: 'Context not found' });
  }
});

app.delete('/contexts/:contextId', (req, res) => {
  const deleted = contextManager.deleteContext(req.params.contextId);
  
  if (deleted) {
    res.status(204).send();
  } else {
    res.status(404).json({ error: 'Context not found' });
  }
});

// Ollama API integration
app.post('/api/chat', async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    
    // Get the conversation context from MCP
    const context = contextManager.getContext(conversationId);
    if (!context) {
      return res.status(404).json({ error: 'Conversation context not found' });
    }
    
    // Format the messages for Ollama
    const messages = context.data.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Call Ollama API
    const ollamaResponse = await axios.post('http://localhost:11434/api/chat', {
      model: 'llama3',
      messages: messages,
      stream: false
    });
    
    // Extract the response
    const assistantResponse = ollamaResponse.data.message.content;
    
    // Send the response back to the client
    res.json({ response: assistantResponse });
    
  } catch (error) {
    console.error('Error calling Ollama API:', error.message);
    res.status(500).json({ 
      error: 'Failed to communicate with Ollama API',
      details: error.message
    });
  }
});

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('subscribe', (contextId) => {
    socket.join(contextId);
    console.log(`Client ${socket.id} subscribed to context: ${contextId}`);
  });
  
  socket.on('unsubscribe', (contextId) => {
    socket.leave(contextId);
    console.log(`Client ${socket.id} unsubscribed from context: ${contextId}`);
  });
  
  socket.on('updateContext', ({ contextId, data }) => {
    const updated = contextManager.updateContext(contextId, data);
    if (updated) {
      const context = contextManager.getContext(contextId);
      io.to(contextId).emit('contextUpdated', { contextId, context });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Handle terminal commands
  socket.on('terminalCommand', (command) => {
    console.log(`Terminal command received: ${command}`);
    
    // Process the command and send back a response
    let response = '';
    
    // Simple command processing
    if (command.startsWith('ping')) {
      response = 'pong!';
    } else if (command.startsWith('system')) {
      response = `System info:\nNode.js ${process.version}\nPlatform: ${process.platform}\nMemory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB used`;
    } else if (command.startsWith('time')) {
      response = `Server time: ${new Date().toISOString()}`;
    } else {
      response = `Command processed: ${command}`;
    }
    
    // Send response back to client
    socket.emit('terminalResponse', {
      output: response,
      timestamp: new Date().toISOString()
    });
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Chat interface available at http://localhost:${PORT}`);
});


// Add this before the server.listen line

// YouTube API endpoint
// Update the YouTube API endpoint with CORS headers
app.get('/api/youtube/search', async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Use the YouTube API
    const apiKey = 'AIzaSyCbZsGHzHtDqoUOVGD0rAhdoNEm3BL-cTY';
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?key=${apiKey}&type=video&part=snippet&q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    // Format the response
    const videos = data.items.map(item => ({
      id: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle
    }));

    res.json({ videos });
  } catch (error) {
    console.error('YouTube API error:', error);
    res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
});