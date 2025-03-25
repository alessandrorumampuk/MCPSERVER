# MCP Chatbot with Llama3 Integration

This extension to the Model Context Protocol (MCP) Server adds a chatbot interface that integrates with Ollama's Llama3 model.

## Prerequisites

1. MCP Server installed and running
2. Ollama installed with Llama3 model pulled

## Setup

1. Make sure Ollama is running with the Llama3 model:
   ```bash
   # If you haven't already pulled the Llama3 model
   ollama pull llama3
   
   # Start Ollama (if not already running)
   ollama serve