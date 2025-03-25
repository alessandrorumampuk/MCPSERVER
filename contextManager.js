/**
 * Model Context Protocol (MCP) Context Manager
 * 
 * Manages context data for the MCP Server
 */
class MCPContextManager {
  constructor() {
    this.contexts = new Map();
    this.contextHistory = new Map();
    this.maxHistoryLength = 100;
  }

  /**
   * Create a new context
   * @param {string} contextId - Unique identifier for the context
   * @param {object} data - Initial context data
   * @returns {object} The created context
   */
  createContext(contextId, data = {}) {
    if (this.contexts.has(contextId)) {
      return this.contexts.get(contextId);
    }
    
    const context = {
      id: contextId,
      data: data || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.contexts.set(contextId, context);
    this.contextHistory.set(contextId, [{ ...context }]);
    
    return context;
  }

  /**
   * Get a context by ID
   * @param {string} contextId - Context identifier
   * @returns {object|null} The context or null if not found
   */
  getContext(contextId) {
    return this.contexts.get(contextId) || null;
  }

  /**
   * Get all contexts
   * @returns {object[]} Array of all contexts
   */
  getAllContexts() {
    return Array.from(this.contexts.values());
  }

  /**
   * Update an existing context
   * @param {string} contextId - Context identifier
   * @param {object} data - New data to merge with existing context
   * @returns {boolean} Success status
   */
  updateContext(contextId, data) {
    if (!this.contexts.has(contextId)) {
      return false;
    }
    
    const context = this.contexts.get(contextId);
    const updatedContext = {
      ...context,
      data: { ...context.data, ...data },
      updatedAt: new Date()
    };
    
    this.contexts.set(contextId, updatedContext);
    
    // Add to history
    const history = this.contextHistory.get(contextId) || [];
    history.push({ ...updatedContext });
    
    // Trim history if needed
    if (history.length > this.maxHistoryLength) {
      history.shift();
    }
    
    this.contextHistory.set(contextId, history);
    
    return true;
  }

  /**
   * Delete a context
   * @param {string} contextId - Context identifier
   * @returns {boolean} Success status
   */
  deleteContext(contextId) {
    if (!this.contexts.has(contextId)) {
      return false;
    }
    
    this.contexts.delete(contextId);
    this.contextHistory.delete(contextId);
    
    return true;
  }

  /**
   * Get context history
   * @param {string} contextId - Context identifier
   * @returns {object[]} Array of context history entries
   */
  getContextHistory(contextId) {
    return this.contextHistory.get(contextId) || [];
  }
}

module.exports = { MCPContextManager };