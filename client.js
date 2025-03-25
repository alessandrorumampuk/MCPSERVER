/**
 * MCP Client Example
 * 
 * This is a simple example of how to use the MCP Server from a client
 */
const io = require('socket.io-client');
const axios = require('axios');

class MCPClient {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.socket = io(serverUrl);
    this.http = axios.create({
      baseURL: serverUrl
    });
    
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to MCP Server');
    });
    
    this.socket.on('disconnect', () => {
      console.log('Disconnected from MCP Server');
    });
    
    this.socket.on('contextUpdated', ({ contextId, context }) => {
      console.log(`Context updated: ${contextId}`, context);
    });
  }

  /**
   * Subscribe to context updates
   * @param {string} contextId - Context to subscribe to
   */
  subscribe(contextId) {
    this.socket.emit('subscribe', contextId);
  }

  /**
   * Unsubscribe from context updates
   * @param {string} contextId - Context to unsubscribe from
   */
  unsubscribe(contextId) {
    this.socket.emit('unsubscribe', contextId);
  }

  /**
   * Create a new context
   * @param {string} contextId - Context identifier
   * @param {object} data - Initial context data
   * @returns {Promise<object>} Created context
   */
  async createContext(contextId, data = {}) {
    const response = await this.http.post('/contexts', { contextId, data });
    return response.data;
  }

  /**
   * Get a context by ID
   * @param {string} contextId - Context identifier
   * @returns {Promise<object>} Context data
   */
  async getContext(contextId) {
    const response = await this.http.get(`/contexts/${contextId}`);
    return response.data;
  }

  /**
   * Update a context
   * @param {string} contextId - Context identifier
   * @param {object} data - Data to update
   * @returns {Promise<object>} Updated context
   */
  async updateContext(contextId, data) {
    // Update via REST API
    const response = await this.http.put(`/contexts/${contextId}`, { data });
    
    // Also notify via socket for real-time updates
    this.socket.emit('updateContext', { contextId, data });
    
    return response.data;
  }

  /**
   * Delete a context
   * @param {string} contextId - Context identifier
   * @returns {Promise<void>}
   */
  async deleteContext(contextId) {
    await this.http.delete(`/contexts/${contextId}`);
  }

  /**
   * Get all contexts
   * @returns {Promise<object[]>} Array of all contexts
   */
  async getAllContexts() {
    const response = await this.http.get('/contexts');
    return response.data;
  }

  /**
   * Close the connection
   */
  disconnect() {
    this.socket.disconnect();
  }
}

// Example usage
async function example() {
  const client = new MCPClient();
  
  // Create a context
  await client.createContext('conversation-123', {
    messages: [],
    metadata: { startTime: new Date() }
  });
  
  // Subscribe to updates
  client.subscribe('conversation-123');
  
  // Update the context
  await client.updateContext('conversation-123', {
    messages: [{ role: 'user', content: 'Hello!' }]
  });
  
  // Get the context
  const context = await client.getContext('conversation-123');
  console.log('Current context:', context);
  
  // Cleanup
  setTimeout(() => {
    client.disconnect();
  }, 5000);
}

// Run the example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

module.exports = { MCPClient };