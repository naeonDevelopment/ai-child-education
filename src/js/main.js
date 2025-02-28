// Import required dependencies
import { createClient } from '@supabase/supabase-js';
import { ZepClient } from '@zep-ai/js-client';
import { OpenAI } from 'openai';

// API configuration (these would be environment variables in a real application)
const SUPABASE_URL = 'https://your-supabase-url.supabase.co';
const SUPABASE_KEY = 'your-supabase-key';
const OPENAI_API_KEY = 'your-openai-api-key';
const ZEP_API_KEY = 'your-zep-api-key';
const ZEP_API_URL = 'https://your-zep-instance-url.com';

// Initialize clients
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const zepClient = new ZepClient(ZEP_API_URL, ZEP_API_KEY);

// DOM elements
const domElements = {
  chatContainer: null,
  chatMessages: null,
  chatInput: null,
  sendButton: null,
  dynamicContent: null,
};

// State management
const state = {
  user: null,
  currentAgent: 'main', // Default to main agent
  sessionId: generateSessionId(),
  isAuthenticated: false,
};

// Initialize the application
function initializeApp() {
  console.log('Initializing AI Education Platform...');
  
  // Check authentication status
  checkAuthStatus();
  
  // Initialize DOM elements
  initializeDomElements();
  
  // Initialize event listeners
  initializeEventListeners();
}

// Check if user is logged in
async function checkAuthStatus() {
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error checking auth status:', error.message);
    return;
  }
  
  if (data?.session) {
    state.user = data.session.user;
    state.isAuthenticated = true;
    updateUIForAuthenticatedUser();
  }
}

// Initialize DOM elements
function initializeDomElements() {
  // Only initialize elements if they exist on the current page
  domElements.chatContainer = document.getElementById('chat-container');
  domElements.chatMessages = document.getElementById('chat-messages');
  domElements.chatInput = document.getElementById('chat-input');
  domElements.sendButton = document.getElementById('send-button');
  domElements.dynamicContent = document.getElementById('dynamic-content');
  
  // Initialize NavBar auth container
  const navAuthContainer = document.getElementById('nav-auth-container');
  if (navAuthContainer) {
    if (state.isAuthenticated) {
      navAuthContainer.innerHTML = \`
        <a href="/dashboard.html" class="text-gray-700 hover:text-primary-600">Dashboard</a>
        <button id="logout-button" class="btn btn-primary">Log out</button>
      \`;
      document.getElementById('logout-button').addEventListener('click', handleLogout);
    }
  }
}

// Initialize event listeners
function initializeEventListeners() {
  // Only add listeners if the elements exist
  if (domElements.chatInput && domElements.sendButton) {
    domElements.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSendMessage();
      }
    });
    
    domElements.sendButton.addEventListener('click', handleSendMessage);
  }
}

// Handle sending a message to an AI agent
async function handleSendMessage() {
  if (!domElements.chatInput || !domElements.chatMessages) return;
  
  const message = domElements.chatInput.value.trim();
  if (!message) return;
  
  // Clear input
  domElements.chatInput.value = '';
  
  // Add user message to chat
  addMessageToChat('user', message);
  
  // Call the AI agent
  const response = await callAgent(state.currentAgent, message);
  
  // Add agent response to chat
  addMessageToChat('agent', response.content);
  
  // Handle any dynamic content from the agent
  if (response.dynamicContent) {
    renderDynamicContent(response.dynamicContent);
  }
}

// Add a message to the chat display
function addMessageToChat(role, content) {
  if (!domElements.chatMessages) return;
  
  const messageElement = document.createElement('div');
  messageElement.classList.add('message');
  
  if (role === 'user') {
    messageElement.classList.add('user-message');
  } else {
    messageElement.classList.add('agent-message');
  }
  
  messageElement.textContent = content;
  domElements.chatMessages.appendChild(messageElement);
  
  // Scroll to the bottom
  domElements.chatMessages.scrollTop = domElements.chatMessages.scrollHeight;
}

// Call an AI agent with a message
async function callAgent(agentId, message) {
  try {
    // Get or create a conversation memory
    const memoryCollection = await zepClient.memory.getOrCreateCollection(
      state.user?.id || 'anonymous',
      { description: `AI education session for user ${state.user?.id || 'anonymous'}` }
    );
    
    // Add message to memory
    await zepClient.memory.addMemory(
      state.user?.id || 'anonymous',
      {
        role: 'user',
        content: message,
      }
    );
    
    // Get conversation history
    const memories = await zepClient.memory.searchMemory(
      state.user?.id || 'anonymous',
      { limit: 10 }
    );
    
    // Format conversation for OpenAI
    const conversationHistory = memories.map(mem => ({
      role: mem.role,
      content: mem.content,
    }));
    
    // Call OpenAI with the appropriate system message based on agent
    const systemMessage = await getAgentSystemMessage(agentId);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemMessage },
        ...conversationHistory,
      ],
      max_tokens: 1000,
    });
    
    // Extract response
    const responseContent = response.choices[0].message.content;
    
    // Add AI response to memory
    await zepClient.memory.addMemory(
      state.user?.id || 'anonymous',
      {
        role: 'assistant',
        content: responseContent,
      }
    );
    
    // Parse for any special commands or dynamic content
    const parsedResponse = parseAgentResponse(responseContent);
    
    return parsedResponse;
  } catch (error) {
    console.error('Error calling agent:', error);
    return {
      content: 'Sorry, I encountered an error. Please try again.',
      dynamicContent: null,
    };
  }
}

// Get the system message for a specific agent
async function getAgentSystemMessage(agentId) {
  // In a real application, these would be fetched from a database
  const systemMessages = {
    main: \`You are the main onboarding assistant for an AI education platform designed for children. 
           You help guide users to the appropriate specialized educational agents and provide general platform assistance.
           You can suggest appropriate educational topics based on the child's age and interests.\`,
    
    science: \`You are a specialized science education agent for children. 
              You make complex scientific concepts accessible and engaging.
              You use simple language and examples that children can understand.\`,
    
    creativity: \`You are a specialized creative arts education agent for children.
                 You encourage artistic expression, storytelling, and imagination.
                 You suggest activities that develop creative thinking.\`,
    
    critical_thinking: \`You are a specialized critical thinking education agent for children.
                         You help develop logical reasoning, problem-solving, and analytical skills.
                         You pose thought-provoking questions and puzzles appropriate for children.\`,
  };
  
  return systemMessages[agentId] || systemMessages.main;
}

// Parse agent response for any special commands or dynamic content
function parseAgentResponse(rawResponse) {
  // Simple parsing logic - in a real app, this would be more sophisticated
  const dynamicContentRegex = /\\[DYNAMIC_CONTENT\\](.*?)\\[\\/DYNAMIC_CONTENT\\]/s;
  const match = rawResponse.match(dynamicContentRegex);
  
  if (match) {
    const dynamicContent = match[1].trim();
    const cleanedResponse = rawResponse.replace(dynamicContentRegex, '').trim();
    
    return {
      content: cleanedResponse,
      dynamicContent: dynamicContent,
    };
  }
  
  return {
    content: rawResponse,
    dynamicContent: null,
  };
}

// Render dynamic content provided by AI agent
function renderDynamicContent(contentString) {
  if (!domElements.dynamicContent) return;
  
  try {
    // Parse the dynamic content - could be HTML, data for visualization, etc.
    // For safety, we'd want proper sanitization here
    domElements.dynamicContent.innerHTML = contentString;
    domElements.dynamicContent.style.display = 'block';
  } catch (error) {
    console.error('Error rendering dynamic content:', error);
  }
}

// Generate a unique session ID
function generateSessionId() {
  return 'session-' + Math.random().toString(36).substring(2, 15);
}

// Handle user logout
async function handleLogout() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Error signing out:', error.message);
    return;
  }
  
  // Redirect to home page
  window.location.href = '/';
}

// Update UI for authenticated users
function updateUIForAuthenticatedUser() {
  const navAuthContainer = document.getElementById('nav-auth-container');
  if (navAuthContainer) {
    navAuthContainer.innerHTML = \`
      <a href="/dashboard.html" class="text-gray-700 hover:text-primary-600">Dashboard</a>
      <button id="logout-button" class="btn btn-primary">Log out</button>
    \`;
    document.getElementById('logout-button').addEventListener('click', handleLogout);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);

// Export functions for usage in other modules if needed
export {
  state,
  callAgent,
  addMessageToChat,
  renderDynamicContent,
};
