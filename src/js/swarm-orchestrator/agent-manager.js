// Agent Manager Module
// Handles agent lifecycle and response generation
// Part of cascading modules for the swarm intelligence system

class AgentManager {
  constructor(core) {
    this.core = core;
  }
  
  // Activate an agent in the swarm
  async activateAgent(agentId, connectionType = 'direct', sourceNodeId = null) {
    try {
      // Skip if agent is already active
      if (this.core.activeAgents.has(agentId)) {
        return true;
      }
      
      // Get agent system prompt from config
      const agentPrompt = window.appConfig.agentPrompts[agentId];
      if (!agentPrompt) {
        throw new Error(`No system prompt found for agent: ${agentId}`);
      }
      
      // Create a new agent instance
      const agent = {
        id: agentId,
        systemPrompt: agentPrompt,
        activatedAt: new Date(),
        status: 'active',
        activeThoughts: new Set(),
        processingHistory: []
      };
      
      // Register the agent
      this.core.activeAgents.set(agentId, agent);
      
      // Update active session agents
      if (this.core.activeSession) {
        this.core.activeSession.agents.add(agentId);
      }
      
      // Create an agent activation node
      if (this.core.activeSession) {
        const activationNode = await window.databaseService.createSwarmNode(
          this.core.activeSession.id,
          this.core.activeSession.userId,
          'agent_activation',
          `Agent ${agentId} activated`,
          { agentId, timestamp: new Date().toISOString() }
        );
        
        if (activationNode) {
          this.core.activeNodes.set(activationNode.id, activationNode);
          agent.activationNodeId = activationNode.id;
          
          // If there's a source node, connect it
          if (sourceNodeId && this.core.activeNodes.has(sourceNodeId)) {
            await window.databaseService.connectThoughts(
              sourceNodeId,
              activationNode.id,
              connectionType,
              0.8,
              { reason: 'Agent activation' }
            );
            
            // Add to thought graph
            this.core._addConnection(sourceNodeId, activationNode.id, connectionType, 0.8);
          }
        }
      }
      
      // Emit agent activation event
      this.core._emitEvent('agent:activate', {
        agentId,
        sessionId: this.core.activeSession?.id
      });
      
      return true;
    } catch (error) {
      console.error(`Error activating agent ${agentId}:`, error);
      return false;
    }
  }

  // Deactivate an agent from the swarm
  async deactivateAgent(agentId) {
    if (!this.core.activeAgents.has(agentId)) {
      console.warn(`Agent ${agentId} is not active`);
      return true;
    }
    
    try {
      const agent = this.core.activeAgents.get(agentId);
      
      // Create a deactivation node
      if (this.core.activeSession) {
        const deactivationNode = await window.databaseService.createSwarmNode(
          this.core.activeSession.id,
          this.core.activeSession.userId,
          'agent_deactivation',
          `Agent ${agentId} deactivated`,
          { agentId, timestamp: new Date().toISOString() }
        );
        
        if (deactivationNode) {
          this.core.activeNodes.set(deactivationNode.id, deactivationNode);
          
          // Connect to activation node
          if (agent.activationNodeId) {
            await window.databaseService.connectThoughts(
              agent.activationNodeId,
              deactivationNode.id,
              'lifecycle',
              1.0,
              { reason: 'Agent lifecycle' }
            );
            
            // Add to thought graph
            this.core._addConnection(agent.activationNodeId, deactivationNode.id, 'lifecycle', 1.0);
          }
        }
      }
      
      // Remove the agent from active agents
      this.core.activeAgents.delete(agentId);
      
      // Emit agent deactivation event
      this.core._emitEvent('agent:deactivate', {
        agentId,
        sessionId: this.core.activeSession?.id
      });
      
      return true;
    } catch (error) {
      console.error(`Error deactivating agent ${agentId}:`, error);
      return false;
    }
  }

  // Generate a response using an agent
  async generateAgentResponse(agentId, message, contextNodes = [], options = {}) {
    try {
      if (!this.core.activeAgents.has(agentId)) {
        throw new Error(`Agent ${agentId} is not active`);
      }
      
      const agent = this.core.activeAgents.get(agentId);
      
      // Create a prompt node
      const promptNode = await window.databaseService.createSwarmNode(
        this.core.activeSession.id,
        this.core.activeSession.userId,
        'agent_prompt',
        message,
        { 
          agentId, 
          timestamp: new Date().toISOString(),
          contextNodeIds: contextNodes.map(node => node.id || node)
        }
      );
      
      if (promptNode) {
        this.core.activeNodes.set(promptNode.id, promptNode);
        
        // Connect to context nodes
        for (const nodeId of contextNodes) {
          const contextNodeId = typeof nodeId === 'object' ? nodeId.id : nodeId;
          
          if (this.core.activeNodes.has(contextNodeId)) {
            await window.databaseService.connectThoughts(
              contextNodeId,
              promptNode.id,
              'context',
              0.6,
              { reason: 'Providing context' }
            );
            
            this.core._addConnection(contextNodeId, promptNode.id, 'context', 0.6);
          }
        }
      }
      
      // Format messages for OpenAI
      const systemMessage = {
        role: 'system',
        content: agent.systemPrompt
      };
      
      // Get conversation history from Zep
      let conversationHistory = [];
      try {
        const memories = await window.zepService.getMemory(
          this.core.activeSession.userId,
          { limit: 10 }
        );
        
        conversationHistory = memories.map(mem => ({
          role: mem.role,
          content: mem.content
        }));
      } catch (error) {
        console.warn('Error getting conversation history from Zep:', error);
        // Continue without history - graceful degradation
      }
      
      // Add the new message
      const userMessage = {
        role: 'user',
        content: message
      };
      
      const messages = [
        systemMessage,
        ...conversationHistory,
        userMessage
      ];
      
      // Get LangChain-style tools if enabled
      const tools = options.useTools ? window.openaiService.getEducationalTools() : undefined;
      
      // Call OpenAI API
      const openaiResponse = await window.openaiService.createChatCompletion(
        messages,
        {
          model: options.model,
          tools: tools,
          toolChoice: options.toolChoice,
          userId: this.core.activeSession.userId
        }
      );
      
      // Create a response node
      const responseNode = await window.databaseService.createSwarmNode(
        this.core.activeSession.id,
        this.core.activeSession.userId,
        'agent_response',
        openaiResponse.content,
        { 
          agentId, 
          timestamp: new Date().toISOString(),
          promptNodeId: promptNode?.id,
          success: openaiResponse.success
        }
      );
      
      if (responseNode) {
        this.core.activeNodes.set(responseNode.id, responseNode);
        
        // Connect prompt to response
        if (promptNode) {
          await window.databaseService.connectThoughts(
            promptNode.id,
            responseNode.id,
            'response',
            1.0,
            { reason: 'Agent response' }
          );
          
          this.core._addConnection(promptNode.id, responseNode.id, 'response', 1.0);
        }
      }
      
      // Add to agent processing history
      agent.processingHistory.push({
        timestamp: new Date(),
        promptNodeId: promptNode?.id,
        responseNodeId: responseNode?.id,
        success: openaiResponse.success
      });
      
      // Extract potential topics from the response
      if (openaiResponse.content) {
        const topics = this._extractTopics(openaiResponse.content);
        for (const topic of topics) {
          this.core.activeSession.topics.add(topic);
        }
      }
      
      // Add to Zep memory
      try {
        await window.zepService.addMemory(
          this.core.activeSession.userId,
          {
            role: 'user',
            content: message,
            agent: agentId
          }
        );
        
        await window.zepService.addMemory(
          this.core.activeSession.userId,
          {
            role: 'assistant',
            content: openaiResponse.content,
            agent: agentId
          }
        );
      } catch (error) {
        console.warn('Error adding to Zep memory:', error);
        // Continue - graceful degradation
      }
      
      // Emit response event
      this.core._emitEvent('agent:response', {
        agentId,
        sessionId: this.core.activeSession?.id,
        responseNodeId: responseNode?.id,
        content: openaiResponse.content
      });
      
      return {
        content: openaiResponse.content,
        nodeId: responseNode?.id,
        success: openaiResponse.success,
        agent: agentId
      };
    } catch (error) {
      console.error(`Error generating response from agent ${agentId}:`, error);
      return {
        content: `I apologize, but I encountered an error while processing your request.`,
        success: false,
        error: error.message,
        agent: agentId
      };
    }
  }
  
  // Extract topics from text using simple keyword extraction
  _extractTopics(text) {
    // This is a simplified topic extraction
    // In production, this would use NLP techniques or an AI model
    
    // Convert to lowercase for matching
    const lowerText = text.toLowerCase();
    
    // Define educational domains and their keywords
    const domainKeywords = {
      science: ['science', 'biology', 'chemistry', 'physics', 'experiment', 'hypothesis', 'atoms', 'molecules', 'ecosystem'],
      math: ['math', 'mathematics', 'algebra', 'geometry', 'calculus', 'equation', 'number', 'fraction', 'decimal'],
      history: ['history', 'ancient', 'civilization', 'empire', 'war', 'revolution', 'king', 'queen', 'president'],
      literature: ['literature', 'book', 'story', 'novel', 'character', 'plot', 'author', 'read', 'write', 'poetry'],
      arts: ['art', 'music', 'painting', 'drawing', 'sculpture', 'instrument', 'creativity', 'imagination'],
      technology: ['technology', 'computer', 'code', 'programming', 'software', 'hardware', 'internet', 'digital']
    };
    
    // Find matching topics
    const topics = [];
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          topics.push(domain);
          break; // Just add the domain once
        }
      }
    }
    
    return [...new Set(topics)]; // Remove duplicates
  }
  
  // Find agent best suited for a topic
  _findRecommendedAgentForTopic(topic) {
    // Simple mapping of topics to agents
    const topicAgentMap = {
      science: 'science',
      math: 'science',
      history: 'critical_thinking',
      literature: 'creativity',
      arts: 'creativity',
      technology: 'science'
    };
    
    return topicAgentMap[topic] || 'main';
  }
}

// Initialize and attach to core
function initAgentManager() {
  if (window.swarmOrchestratorCore) {
    window.agentManager = new AgentManager(window.swarmOrchestratorCore);
    
    // Add methods to core for easy access
    window.swarmOrchestratorCore.activateAgent = (agentId, connectionType, sourceNodeId) => 
      window.agentManager.activateAgent(agentId, connectionType, sourceNodeId);
    
    window.swarmOrchestratorCore.deactivateAgent = (agentId) => 
      window.agentManager.deactivateAgent(agentId);
    
    window.swarmOrchestratorCore.generateAgentResponse = (agentId, message, contextNodes, options) => 
      window.agentManager.generateAgentResponse(agentId, message, contextNodes, options);
    
    console.log('Agent Manager initialized and attached to Orchestrator Core');
  } else {
    console.error('Orchestrator Core not found. Make sure to load orchestrator-core.js first');
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', initAgentManager);
