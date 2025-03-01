// Zep Memory Integration Service
// Provides conversation memory for the AI agents

class ZepMemoryService {
  constructor() {
    this.apiUrl = window.appConfig.zep.apiUrl;
    this.apiKey = window.appConfig.zep.apiKey;
    this.initialized = false;
  }

  // Initialize memory collection for a user
  async initializeMemory(userId) {
    try {
      const collectionName = `user_${userId}`;
      const response = await fetch(`${this.apiUrl}/collections/${collectionName}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      // If collection doesn't exist, create it
      if (response.status === 404) {
        await this.createCollection(collectionName);
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Zep memory:', error);
      // Fallback to local memory if Zep fails
      this.useFallback = true;
      return false;
    }
  }

  // Create a new memory collection
  async createCollection(collectionName) {
    try {
      const response = await fetch(`${this.apiUrl}/collections`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          name: collectionName,
          description: `Memory collection for ${collectionName}`,
          metadata: {
            source: 'ai-child-education-platform'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create collection: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating Zep collection:', error);
      this.useFallback = true;
      throw error;
    }
  }

  // Add a message to memory
  async addMemory(userId, message) {
    if (this.useFallback) {
      return this.addToLocalMemory(userId, message);
    }

    if (!this.initialized) {
      await this.initializeMemory(userId);
    }

    try {
      const collectionName = `user_${userId}`;
      const response = await fetch(`${this.apiUrl}/collections/${collectionName}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          messages: [
            {
              role: message.role,
              content: message.content,
              metadata: {
                agent: message.agent || 'main',
                timestamp: new Date().toISOString()
              }
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add memory: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error adding memory to Zep:', error);
      return this.addToLocalMemory(userId, message);
    }
  }

  // Get memory for a conversation
  async getMemory(userId, options = {}) {
    if (this.useFallback) {
      return this.getLocalMemory(userId);
    }

    if (!this.initialized) {
      await this.initializeMemory(userId);
    }

    try {
      const collectionName = `user_${userId}`;
      const limit = options.limit || 10;
      const response = await fetch(`${this.apiUrl}/collections/${collectionName}/messages?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get memory: ${response.statusText}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (error) {
      console.error('Error retrieving memory from Zep:', error);
      return this.getLocalMemory(userId);
    }
  }

  // Search memory by query
  async searchMemory(userId, query, options = {}) {
    if (this.useFallback) {
      return this.searchLocalMemory(userId, query);
    }

    if (!this.initialized) {
      await this.initializeMemory(userId);
    }

    try {
      const collectionName = `user_${userId}`;
      const limit = options.limit || 5;
      const response = await fetch(`${this.apiUrl}/collections/${collectionName}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query: query,
          limit: limit,
          search_scope: "message"
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to search memory: ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching Zep memory:', error);
      return this.searchLocalMemory(userId, query);
    }
  }

  // Local fallback methods for memory management
  // Used when Zep API is unavailable
  
  addToLocalMemory(userId, message) {
    if (!window.localMemory) {
      window.localMemory = {};
    }
    
    if (!window.localMemory[userId]) {
      window.localMemory[userId] = [];
    }
    
    window.localMemory[userId].push({
      ...message,
      timestamp: new Date().toISOString()
    });
    
    // Limit local memory to last 20 messages
    if (window.localMemory[userId].length > 20) {
      window.localMemory[userId].shift();
    }
    
    return {
      success: true,
      message: "Added to local memory fallback"
    };
  }
  
  getLocalMemory(userId) {
    if (!window.localMemory || !window.localMemory[userId]) {
      return [];
    }
    
    return window.localMemory[userId];
  }
  
  searchLocalMemory(userId, query) {
    if (!window.localMemory || !window.localMemory[userId]) {
      return [];
    }
    
    // Simple text search in local memory
    return window.localMemory[userId].filter(msg => 
      msg.content.toLowerCase().includes(query.toLowerCase())
    );
  }
}

// Create and export the service
window.zepService = new ZepMemoryService();
