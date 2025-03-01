// Core Swarm Orchestrator
// Implements the base orchestration functionality
// Part of cascading modules for the swarm intelligence system

class SwarmOrchestratorCore {
  constructor() {
    this.activeSession = null;
    this.activeAgents = new Map();
    this.activeNodes = new Map();
    this.thoughtGraph = new Map();
    this.eventListeners = new Map();
    this.processingQueue = [];
    this.isProcessing = false;
    this.userId = null;
    this.initialized = false;
    this.maxParallelProcesses = 3; // Max number of parallel processes
  }

  // Initialize the orchestrator
  async initialize(userId) {
    if (this.initialized) return true;

    try {
      this.userId = userId;
      
      // Initialize required services
      if (!window.databaseService) {
        console.error('Database service not found in global context');
        return false;
      }
      
      if (!window.openaiService) {
        console.error('OpenAI service not found in global context');
        return false;
      }
      
      if (!window.zepService) {
        console.error('Zep service not found in global context');
        return false;
      }
      
      // Initialize the database
      const dbInitialized = await window.databaseService.initialize();
      if (!dbInitialized) {
        console.error('Failed to initialize database service');
        return false;
      }
      
      // Register default agents
      this._registerDefaultAgents();
      
      // Register event handlers
      this._registerEventHandlers();
      
      this.initialized = true;
      console.log('Swarm orchestrator initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing swarm orchestrator:', error);
      return false;
    }
  }

  // Start a new learning session
  async startSession(userId, primaryAgentId = 'main') {
    try {
      if (!this.initialized) {
        await this.initialize(userId);
      }
      
      // Create a new session in the database
      const session = await window.databaseService.startLearningSession(userId, primaryAgentId);
      if (!session) {
        throw new Error('Failed to create learning session');
      }
      
      this.activeSession = {
        id: session.id,
        userId,
        primaryAgentId,
        startTime: new Date(),
        topics: new Set(),
        agents: new Set([primaryAgentId]),
        status: 'active'
      };
      
      // Create the initial swarm node (entry point)
      const entryNode = await window.databaseService.createSwarmNode(
        session.id, 
        userId, 
        'session_start', 
        'Learning session initialized',
        { agentId: primaryAgentId }
      );
      
      if (entryNode) {
        this.activeNodes.set(entryNode.id, entryNode);
      }
      
      // Activate the primary agent
      await this.activateAgent(primaryAgentId);
      
      // Emit session start event
      this._emitEvent('session:start', {
        sessionId: session.id,
        userId,
        primaryAgentId
      });
      
      return session;
    } catch (error) {
      console.error('Error starting session:', error);
      return null;
    }
  }

  // End the current learning session
  async endSession(summary = '') {
    try {
      if (!this.activeSession) {
        console.warn('No active session to end');
        return false;
      }
      
      // Convert topics set to array
      const topicsCovered = Array.from(this.activeSession.topics);
      
      // End the session in the database
      const session = await window.databaseService.endLearningSession(
        this.activeSession.id,
        summary,
        topicsCovered
      );
      
      if (!session) {
        throw new Error('Failed to end learning session');
      }
      
      // Clear active agents and nodes
      this.activeAgents.clear();
      this.activeNodes.clear();
      this.thoughtGraph.clear();
      this.processingQueue = [];
      
      // Emit session end event
      this._emitEvent('session:end', {
        sessionId: this.activeSession.id,
        userId: this.activeSession.userId,
        summary,
        topicsCovered
      });
      
      // Clear the active session
      const sessionData = { ...this.activeSession, status: 'completed' };
      this.activeSession = null;
      
      return sessionData;
    } catch (error) {
      console.error('Error ending session:', error);
      return false;
    }
  }

  // Process a user message through the swarm
  async processUserMessage(message, options = {}) {
    try {
      if (!this.activeSession) {
        throw new Error('No active session found');
      }
      
      // Create a user message node
      const userNode = await window.databaseService.createSwarmNode(
        this.activeSession.id,
        this.activeSession.userId,
        'user_message',
        message,
        { timestamp: new Date().toISOString() }
      );
      
      if (userNode) {
        this.activeNodes.set(userNode.id, userNode);
      }
      
      // Add the message to the processing queue
      const processingTask = {
        type: 'user_message',
        message,
        nodeId: userNode?.id,
        options,
        timestamp: Date.now()
      };
      
      this.processingQueue.push(processingTask);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this._processQueue();
      }
      
      return {
        success: true,
        messageId: userNode?.id
      };
    } catch (error) {
      console.error('Error processing user message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Event system
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    
    this.eventListeners.get(eventName).push(callback);
    
    return this; // For chaining
  }
  
  off(eventName, callback) {
    if (!this.eventListeners.has(eventName)) return this;
    
    if (!callback) {
      // Remove all listeners for this event
      this.eventListeners.delete(eventName);
    } else {
      // Remove specific listener
      const listeners = this.eventListeners.get(eventName);
      const index = listeners.indexOf(callback);
      
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      if (listeners.length === 0) {
        this.eventListeners.delete(eventName);
      }
    }
    
    return this; // For chaining
  }
  
  _emitEvent(eventName, data = {}) {
    if (!this.eventListeners.has(eventName)) return;
    
    const listeners = this.eventListeners.get(eventName);
    
    for (const listener of listeners) {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventName}:`, error);
      }
    }
  }
  
  // Graph management
  _addConnection(sourceNodeId, targetNodeId, connectionType, strength = 1.0) {
    if (!this.thoughtGraph.has(sourceNodeId)) {
      this.thoughtGraph.set(sourceNodeId, new Map());
    }
    
    const connections = this.thoughtGraph.get(sourceNodeId);
    connections.set(targetNodeId, {
      type: connectionType,
      strength,
      timestamp: new Date()
    });
  }
  
  // Register default agents
  _registerDefaultAgents() {
    // Register the main agent types from config
    const agentIds = Object.keys(window.appConfig.agentPrompts || {});
    
    for (const agentId of agentIds) {
      this.activeAgents.set(agentId, {
        id: agentId,
        systemPrompt: window.appConfig.agentPrompts[agentId],
        status: 'ready', // Not active until explicitly activated
        processingHistory: []
      });
    }
  }
  
  // Register event handlers
  _registerEventHandlers() {
    // Default handlers for logging
    this.on('agent:activate', data => {
      console.log(`Agent activated: ${data.agentId}`);
    });
    
    this.on('agent:deactivate', data => {
      console.log(`Agent deactivated: ${data.agentId}`);
    });
    
    this.on('session:start', data => {
      console.log(`Session started: ${data.sessionId}`);
    });
    
    this.on('session:end', data => {
      console.log(`Session ended: ${data.sessionId}`);
    });
    
    this.on('task:error', data => {
      console.error(`Task error: ${data.error}`);
    });
  }
}

// Export the orchestrator
window.swarmOrchestratorCore = new SwarmOrchestratorCore();
