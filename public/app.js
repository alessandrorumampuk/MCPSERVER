document.addEventListener('DOMContentLoaded', () => {
    // Connect to the MCP server
    const socket = io();
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    
    // Generate a unique conversation ID for this chat session
    // Use stored ID if available, otherwise create new one
    const conversationId = localStorage.getItem('currentConversationId') || 'chat-' + Date.now();
    localStorage.setItem('currentConversationId', conversationId);
    
    let messageHistory = [];
    
    // Subscribe to updates for this conversation
    socket.emit('subscribe', conversationId);
    
    // Function to communicate with service worker
    async function sendToServiceWorker(action, data) {
        if (!navigator.serviceWorker.controller) {
            return null;
        }
        
        return new Promise(resolve => {
            const channel = new MessageChannel();
            
            channel.port1.onmessage = event => {
                resolve(event.data);
            };
            
            navigator.serviceWorker.controller.postMessage(
                { action, ...data },
                [channel.port2]
            );
        });
    }
    
    // Function to store message in service worker
    async function storeMessageInSW(message) {
        return sendToServiceWorker('storeMessage', {
            conversationId,
            message
        });
    }
    
    // Function to get messages from service worker
    async function getMessagesFromSW() {
        const result = await sendToServiceWorker('getMessages', {
            conversationId
        });
        return result ? result.messages : [];
    }
    
    // Initialize the context in MCP server
    fetch('/contexts', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contextId: conversationId,
            data: {
                messages: messageHistory
            }
        })
    });
    
    // Listen for context updates
    socket.on('contextUpdated', ({ contextId, context }) => {
        if (contextId === conversationId) {
            // Update our local message history
            messageHistory = context.data.messages || [];
        }
    });
    
    // Function to add a message to the chat UI
    // Update the addMessageToChat function
    function addMessageToChat(content, role) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Process content for YouTube links if it's a bot message
        if (role === 'bot') {
            messageContent.innerHTML = processMessageContent(content);
        } else {
            messageContent.textContent = content;
        }
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to show typing indicator
    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator';
        indicator.id = 'typing-indicator';
        
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'typing-dot';
            indicator.appendChild(dot);
        }
        
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // Function to hide typing indicator
    function hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Function to send a message to the Llama3 model via Ollama
    async function sendMessageToLlama(userMessage) {
        // Add user message to UI
        addMessageToChat(userMessage, 'user');
        
        // Add user message to history
        const userMessageObj = {
            role: 'user',
            content: userMessage
        };
        
        messageHistory.push(userMessageObj);
        
        // Store message in service worker
        await storeMessageInSW(userMessageObj);
        
        // Update the context in MCP
        await fetch(`/contexts/${conversationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: {
                    messages: messageHistory
                }
            })
        });
        
        // Show typing indicator
        showTypingIndicator();
        
        try {
            // Send request to our backend which will forward to Ollama
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    conversationId: conversationId,
                    message: userMessage
                })
            });
            
            const data = await response.json();
            
            // Hide typing indicator
            hideTypingIndicator();
            
            // Add bot response to UI
            addMessageToChat(data.response, 'bot');
            
            // Add bot message to history
            const botMessageObj = {
                role: 'assistant',
                content: data.response
            };
            
            messageHistory.push(botMessageObj);
            
            // Store message in service worker
            await storeMessageInSW(botMessageObj);
            
            // Update the context in MCP
            await fetch(`/contexts/${conversationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        messages: messageHistory
                    }
                })
            });
            
        } catch (error) {
            console.error('Error:', error);
            hideTypingIndicator();
            addMessageToChat('Sorry, there was an error processing your request. If you\'re offline, your message has been saved and will be processed when you\'re back online.', 'system');
        }
    }
    
    // Load previous messages from service worker
    async function loadPreviousMessages() {
        const storedMessages = await getMessagesFromSW();
        
        if (storedMessages && storedMessages.length > 0) {
            // Clear the initial system message
            chatMessages.innerHTML = '';
            
            // Add stored messages to UI and history
            storedMessages.forEach(item => {
                addMessageToChat(item.message.content, item.message.role === 'user' ? 'user' : 'bot');
                messageHistory.push(item.message);
            });
            
            // Update the context in MCP
            await fetch(`/contexts/${conversationId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: {
                        messages: messageHistory
                    }
                })
            });
        }
    }
    
    // Load previous messages when page loads
    loadPreviousMessages();
    
    // Event listener for send button
    sendButton.addEventListener('click', () => {
        const message = userInput.value.trim();
        if (message) {
            sendMessageToLlama(message);
            userInput.value = '';
        }
    });
    
    // Event listener for Enter key
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendButton.click();
        }
    });
    
    // Check for online/offline status
    window.addEventListener('online', () => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = 'You are back online.';
        messageContent.style.color = '#28a745'; // Green color
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    
    window.addEventListener('offline', () => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = 'You are offline.';
        messageContent.style.color = '#dc3545'; // Red color
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    
    // Add a clear conversation button to the header
    const chatHeader = document.querySelector('.chat-header');
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear';
    clearButton.className = 'clear-button';
    chatHeader.appendChild(clearButton);
    
    clearButton.addEventListener('click', () => {
        if (confirm('Start a new conversation? This will clear the current chat.')) {
            // Generate new conversation ID
            const newConversationId = 'chat-' + Date.now();
            localStorage.setItem('currentConversationId', newConversationId);
            
            // Reload the page to start fresh
            window.location.reload();
        }
    });
});

// Add this function to your app.js file
function processMessageContent(content) {
  // Regular expression to match YouTube URLs
  const youtubeRegex = /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)(?:&[^\ ]+)?|https?:\/\/(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)(?:\?[^\ ]+)?/g;
  
  // Replace YouTube links with embeds
  return content.replace(youtubeRegex, (match, id1, id2) => {
    const videoId = id1 || id2;
    return `
      <div class="youtube-embed">
        <a href="${match}" target="_blank" class="youtube-link">${match}</a>
        <div class="youtube-preview">
          <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" alt="YouTube Video Thumbnail">
          <div class="youtube-play-button" data-id="${videoId}">▶</div>
        </div>
      </div>
    `;
  });
}

// Add this at the end of your DOMContentLoaded event listener
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('youtube-play-button')) {
        const videoId = e.target.getAttribute('data-id');
        const previewContainer = e.target.closest('.youtube-preview');
        
        // Replace the preview with an iframe
        previewContainer.innerHTML = `
            <iframe 
                width="100%" 
                height="200" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                title="YouTube video player" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
    }
});