// Chat functionality for the AI education platform
// Handles direct API calls to OpenAI and manages the chat interface

// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const dynamicContent = document.getElementById('dynamic-content');
const currentAgentName = document.getElementById('current-agent-name');
const currentAgentDescription = document.getElementById('current-agent-description');

// State
const state = {
  currentAgentId: 'main',
  messages: [],
  sessionId: generateSessionId()
};

// Conversation memory (simple in-browser implementation)
const conversationMemory = {
  messages: [],
  
  addMessage(role, content) {
    this.messages.push({ role, content, timestamp: new Date().toISOString() });
    
    // Limit memory to last 20 messages to avoid token limits
    if (this.messages.length > 20) {
      this.messages.shift();
    }
  },
  
  getMessages() {
    return this.messages;
  },
  
  clear() {
    this.messages = [];
  }
};

// Initialize
function init() {
  // Add event listeners
  sendButton.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  });
  
  // Set up agent selection
  setupAgentSelection();
  
  // Add initial message to memory
  conversationMemory.addMessage('assistant', 'Hello! I\'m your AI guide for learning new and exciting things. What would you like to explore today?');
}

// Set up agent selection
function setupAgentSelection() {
  const agentCards = document.querySelectorAll('.agent-card');
  
  agentCards.forEach(card => {
    card.addEventListener('click', () => {
      // Get agent ID from data attribute
      const agentId = card.getAttribute('data-agent-id');
      
      // Update selected agent UI
      agentCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      
      // Handle agent change
      changeAgent(agentId);
    });
  });
}

// Change the current agent
function changeAgent(agentId) {
  // Don't do anything if it's the same agent
  if (agentId === state.currentAgentId) return;
  
  // Update state
  state.currentAgentId = agentId;
  
  // Update agent info in UI
  const agentInfo = window.appConfig.agentInfo[agentId];
  currentAgentName.textContent = agentInfo.name;
  currentAgentDescription.textContent = agentInfo.description;
  
  // Update avatar
  const avatarContainer = currentAgentName.closest('div').previousElementSibling;
  avatarContainer.className = `avatar-container avatar-medium mr-3 ${agentInfo.avatarBg}`;
  avatarContainer.querySelector('span').className = agentInfo.textColor;
  avatarContainer.querySelector('span').textContent = agentInfo.initial;
  
  // Add transition message
  addMessageToChat('agent', `I'm ${agentInfo.name}, ${agentInfo.description.toLowerCase()}. How can I help you?`);
  conversationMemory.addMessage('assistant', `I'm ${agentInfo.name}, ${agentInfo.description.toLowerCase()}. How can I help you?`);
}

// Handle sending a message
async function handleSendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  
  // Clear input
  chatInput.value = '';
  
  // Add message to UI
  addMessageToChat('user', message);
  
  // Add to memory
  conversationMemory.addMessage('user', message);
  
  // Show typing indicator
  const typingIndicator = addTypingIndicator();
  
  try {
    // Call AI API
    const response = await callOpenAI(message);
    
    // Remove typing indicator
    if (typingIndicator) {
      typingIndicator.remove();
    }
    
    // Add response to UI
    addMessageToChat('agent', response.content);
    
    // Add to memory
    conversationMemory.addMessage('assistant', response.content);
    
    // Handle dynamic content if present
    if (response.dynamicContent) {
      renderDynamicContent(response.dynamicContent);
    }
  } catch (error) {
    // Remove typing indicator
    if (typingIndicator) {
      typingIndicator.remove();
    }
    
    console.error('Error calling AI:', error);
    addMessageToChat('agent', 'Sorry, I encountered an error. Please try again.');
  }
}

// Add a message to the chat UI
function addMessageToChat(role, content) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  
  if (role === 'user') {
    messageElement.classList.add('user-message');
  } else {
    messageElement.classList.add('agent-message');
  }
  
  messageElement.textContent = content;
  chatMessages.appendChild(messageElement);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return messageElement;
}

// Add typing indicator
function addTypingIndicator() {
  const typingElement = document.createElement('div');
  typingElement.classList.add('message', 'agent-message', 'typing-indicator');
  typingElement.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(typingElement);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  return typingElement;
}

// Call OpenAI API directly from the browser
async function callOpenAI(userMessage) {
  // Get current user for identity
  const user = window.auth?.getCurrentUser() || { id: 'anonymous' };
  
  // Prepare OpenAI message format
  const messages = [
    {
      role: 'system',
      content: window.appConfig.agentPrompts[state.currentAgentId]
    },
    ...conversationMemory.getMessages().map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];
  
  // In a production app, you would add a proxy server here to protect your API key
  // For this demo, we're showing the direct API call
  const response = await fetch(window.appConfig.openai.apiUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getOpenAIKey() // In production, this should never be exposed to the client
    },
    body: JSON.stringify({
      model: window.appConfig.openai.model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
      user: user.id
    })
  });
  
  if (!response.ok) {
    throw new Error('API call failed: ' + await response.text());
  }
  
  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Parse for any dynamic content
  return parseResponse(content);
}

// Parse the response for any dynamic content
function parseResponse(content) {
  // Check for dynamic content markers
  const dynamicContentRegex = /\\[DYNAMIC_CONTENT\\](.*?)\\[\\/DYNAMIC_CONTENT\\]/s;
  const match = content.match(dynamicContentRegex);
  
  if (match) {
    // Extract dynamic content
    const dynamicContent = match[1].trim();
    
    // Remove dynamic content from message
    const cleanContent = content.replace(dynamicContentRegex, '').trim();
    
    return {
      content: cleanContent,
      dynamicContent
    };
  }
  
  return {
    content,
    dynamicContent: null
  };
}

// Render dynamic content from the AI
function renderDynamicContent(content) {
  // Only proceed if we have content and container
  if (!content || !dynamicContent) return;
  
  try {
    // In a production app, you would sanitize this content
    dynamicContent.innerHTML = content;
    dynamicContent.style.display = 'block';
  } catch (error) {
    console.error('Error rendering dynamic content:', error);
  }
}

// Generate a session ID
function generateSessionId() {
  return 'session-' + Math.random().toString(36).substring(2, 15);
}

// Get OpenAI API key (in production this would be handled by your backend)
function getOpenAIKey() {
  // IMPORTANT: In a real application, NEVER expose your API key in client-side code
  // This is for demonstration purposes only
  // You would typically have a server endpoint that makes the API call
  // For educational purposes only - replace with your own key for testing
  return 'sk-...'; // Intentionally incomplete
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
