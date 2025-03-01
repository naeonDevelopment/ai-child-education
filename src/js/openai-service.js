// OpenAI Integration Service with LangChain-inspired patterns
// Provides AI agent capabilities using the OpenAI API

class OpenAIService {
  constructor() {
    this.apiUrl = window.appConfig.openai.apiUrl;
    this.defaultModel = window.appConfig.openai.model;
    // API key should be provided through secure methods, not hardcoded
  }

  // Create a chat completion with the OpenAI API
  async createChatCompletion(messages, options = {}) {
    try {
      const model = options.model || this.defaultModel;
      const maxTokens = options.maxTokens || 1000;
      const temperature = options.temperature || 0.7;
      const tools = options.tools || null;
      const toolChoice = options.toolChoice || null;
      
      const requestBody = {
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
        user: options.userId || 'anonymous'
      };
      
      // Add tools if provided
      if (tools && tools.length > 0) {
        requestBody.tools = tools;
      }
      
      // Add tool choice if provided
      if (toolChoice) {
        requestBody.tool_choice = toolChoice;
      }

      // For streaming responses
      if (options.stream) {
        return this._streamChatCompletion(requestBody);
      }
      
      // In a production environment, we would use a proxy server to make the API call
      // For now, we'll use a demo approach with a secure key getter
      const apiKey = this._getSecureApiKey();
      
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle tool calls if present
      if (data.choices[0]?.message?.tool_calls) {
        return await this._handleToolCalls(data.choices[0].message, messages, options);
      }
      
      return {
        content: data.choices[0]?.message?.content || '',
        success: true,
        role: data.choices[0]?.message?.role || 'assistant',
        messageId: data.id
      };
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      return {
        content: 'I apologize, but I encountered an error while processing your request.',
        success: false,
        error: error.message
      };
    }
  }

  // Get API key securely from config
  _getSecureApiKey() {
    // In production, this would fetch from a secure backend or environment variable
    // For development, we'll return a placeholder and rely on the proxy service
    return 'OPENAI_API_KEY';
  }

  // Stream chat completion responses
  async _streamChatCompletion(requestBody) {
    try {
      requestBody.stream = true;
      
      const apiKey = this._getSecureApiKey();
      
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      // Return the response directly for streaming
      return response;
    } catch (error) {
      console.error('Error streaming from OpenAI:', error);
      throw error;
    }
  }

  // Process streaming response chunks
  async processStreamingResponse(response, callbacks) {
    try {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            const data = JSON.parse(line.substring(6));
            const content = data.choices[0]?.delta?.content || '';
            
            if (callbacks?.onToken && content) {
              callbacks.onToken(content);
            }
            
            if (data.choices[0]?.delta?.tool_calls && callbacks?.onToolCall) {
              callbacks.onToolCall(data.choices[0].delta.tool_calls);
            }
          } else if (line === 'data: [DONE]') {
            if (callbacks?.onComplete) {
              callbacks.onComplete();
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing streaming response:', error);
      if (callbacks?.onError) {
        callbacks.onError(error);
      }
    }
  }

  // Handle tool calls from OpenAI responses
  async _handleToolCalls(message, messages, options) {
    try {
      const toolCalls = message.tool_calls || [];
      const toolResults = [];
      
      for (const toolCall of toolCalls) {
        try {
          // Parse the function call
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          // Execute the function if it exists in our tool handlers
          if (this._toolHandlers[functionName]) {
            const result = await this._toolHandlers[functionName](functionArgs);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: functionName,
              content: JSON.stringify(result)
            });
          } else {
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: functionName,
              content: JSON.stringify({ error: 'Function not implemented' })
            });
          }
        } catch (error) {
          console.error(`Error executing tool ${toolCall.function.name}:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify({ error: error.message })
          });
        }
      }
      
      // Add the assistant message with tool calls and tool results to the messages
      const updatedMessages = [
        ...messages,
        message,
        ...toolResults
      ];
      
      // Call the API again with the updated messages
      return this.createChatCompletion(updatedMessages, options);
    } catch (error) {
      console.error('Error handling tool calls:', error);
      return {
        content: 'I apologize, but I encountered an error while processing tool calls.',
        success: false,
        error: error.message
      };
    }
  }

  // Define standard tools for educational agents
  getEducationalTools() {
    return [
      {
        type: "function",
        function: {
          name: "searchEducationalContent",
          description: "Search for educational content on a specific topic",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The search query"
              },
              ageGroup: {
                type: "string",
                enum: ["young", "middle", "teen"],
                description: "Target age group: young (5-8), middle (9-12), teen (13-16)"
              },
              maxTokens: {
                type: "integer",
                description: "Maximum number of tokens for the response"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "researchTopic",
          description: "Research a topic in depth and provide structured educational content",
          parameters: {
            type: "object",
            properties: {
              topic: {
                type: "string",
                description: "The topic to research"
              },
              ageGroup: {
                type: "string",
                enum: ["young", "middle", "teen"],
                description: "Target age group: young (5-8), middle (9-12), teen (13-16)"
              }
            },
            required: ["topic"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generateAvatarResponse",
          description: "Generate a video response with an AI avatar",
          parameters: {
            type: "object",
            properties: {
              text: {
                type: "string",
                description: "The text for the avatar to speak"
              },
              avatarId: {
                type: "string",
                description: "The ID of the avatar to use"
              },
              voiceId: {
                type: "string",
                description: "The ID of the voice to use"
              },
              style: {
                type: "string",
                enum: ["normal", "happy", "sad", "surprised", "angry"],
                description: "The emotional style for the avatar"
              }
            },
            required: ["text", "avatarId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generateUIComponent",
          description: "Generate an interactive UI component",
          parameters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["quiz", "flashcards", "timeline", "diagram", "custom"],
                description: "The type of component to generate"
              },
              title: {
                type: "string",
                description: "The title of the component"
              },
              content: {
                type: "string",
                description: "The content for the component (for custom components)"
              },
              questions: {
                type: "array",
                description: "The questions for a quiz component",
                items: {
                  type: "object",
                  properties: {
                    question: {
                      type: "string",
                      description: "The question text"
                    },
                    options: {
                      type: "array",
                      description: "The answer options",
                      items: {
                        type: "string"
                      }
                    },
                    correctAnswer: {
                      type: "integer",
                      description: "The index of the correct answer"
                    }
                  }
                }
              },
              cards: {
                type: "array",
                description: "The cards for a flashcards component",
                items: {
                  type: "object",
                  properties: {
                    front: {
                      type: "string",
                      description: "The text for the front of the card"
                    },
                    back: {
                      type: "string",
                      description: "The text for the back of the card"
                    }
                  }
                }
              },
              events: {
                type: "array",
                description: "The events for a timeline component",
                items: {
                  type: "object",
                  properties: {
                    date: {
                      type: "string",
                      description: "The date or time period"
                    },
                    title: {
                      type: "string",
                      description: "The title of the event"
                    },
                    description: {
                      type: "string",
                      description: "The description of the event"
                    }
                  }
                }
              }
            },
            required: ["type"]
          }
        }
      }
    ];
  }

  // Tool handlers for function calling
  _toolHandlers = {
    // Search for educational content
    async searchEducationalContent(args) {
      try {
        // Use Perplexity for educational searches
        const result = await window.perplexityService.search(args.query, {
          maxTokens: args.maxTokens || 500
        });
        
        return {
          success: true,
          content: result.content
        };
      } catch (error) {
        console.error('Error searching educational content:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },
    
    // Research a topic in depth
    async researchTopic(args) {
      try {
        // Use Perplexity to research the topic
        const result = await window.perplexityService.researchTopic(args.topic, {
          ageGroup: args.ageGroup || 'middle'
        });
        
        return {
          success: true,
          content: result.content
        };
      } catch (error) {
        console.error('Error researching topic:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },
    
    // Generate an avatar response
    async generateAvatarResponse(args) {
      try {
        // Use HeyGen to generate an avatar response
        const result = await window.heygenService.generateVideo(
          args.text,
          args.avatarId,
          {
            voiceId: args.voiceId,
            style: args.style || 'normal'
          }
        );
        
        return {
          success: result.success,
          videoUrl: result.videoUrl,
          videoId: result.videoId
        };
      } catch (error) {
        console.error('Error generating avatar response:', error);
        return {
          success: false,
          error: error.message
        };
      }
    },
    
    // Generate interactive UI component
    async generateUIComponent(args) {
      // This would typically call a service to generate UI components
      // For now, we'll return predefined HTML for common components
      
      const componentType = args.type?.toLowerCase() || '';
      let htmlContent = '';
      
      if (componentType === 'quiz') {
        htmlContent = this._generateQuizHTML(args.questions);
      } else if (componentType === 'flashcards') {
        htmlContent = this._generateFlashcardsHTML(args.cards);
      } else if (componentType === 'timeline') {
        htmlContent = this._generateTimelineHTML(args.events);
      } else {
        htmlContent = `<div class="p-4 border border-gray-200 rounded-lg">
          <h3 class="text-lg font-semibold">${args.title || 'Interactive Component'}</h3>
          <p>${args.content || 'Content not provided'}</p>
        </div>`;
      }
      
      return {
        success: true,
        html: htmlContent,
        type: componentType
      };
    }
  };
  
  // Helper methods for generating UI components
  
  _generateQuizHTML(questions = []) {
    if (!questions || questions.length === 0) {
      questions = [
        {
          question: 'Sample question?',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 0
        }
      ];
    }
    
    let html = `
      <div class="quiz-container p-4 bg-white rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">Quiz</h3>
        <form id="quiz-form">
    `;
    
    questions.forEach((q, qIndex) => {
      html += `
        <div class="question-container mb-6">
          <p class="font-medium mb-2">${qIndex + 1}. ${q.question}</p>
          <div class="options space-y-2">
      `;
      
      q.options.forEach((option, oIndex) => {
        html += `
          <div class="option">
            <input type="radio" id="q${qIndex}_o${oIndex}" name="q${qIndex}" value="${oIndex}">
            <label for="q${qIndex}_o${oIndex}" class="ml-2">${option}</label>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += `
        <button type="button" id="submit-quiz" class="btn btn-primary mt-4">Check Answers</button>
        <div id="quiz-results" class="mt-4 p-3 border rounded hidden"></div>
      </form>
      <script>
        document.getElementById('submit-quiz').addEventListener('click', function() {
          const form = document.getElementById('quiz-form');
          const results = document.getElementById('quiz-results');
          let score = 0;
          const correctAnswers = ${JSON.stringify(questions.map(q => q.correctAnswer))};
          
          for (let i = 0; i < correctAnswers.length; i++) {
            const selected = form.querySelector('input[name="q'+i+'"]:checked');
            if (selected && parseInt(selected.value) === correctAnswers[i]) {
              score++;
            }
          }
          
          results.textContent = 'You scored ' + score + ' out of ' + correctAnswers.length;
          results.classList.remove('hidden');
          results.classList.add('bg-green-50', 'text-green-800');
        });
      </script>
    </div>
    `;
    
    return html;
  }
  
  _generateFlashcardsHTML(cards = []) {
    if (!cards || cards.length === 0) {
      cards = [
        { front: 'Sample Question', back: 'Sample Answer' }
      ];
    }
    
    let html = `
      <div class="flashcards-container p-4 bg-white rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">Flashcards</h3>
        <div class="flashcards-deck">
    `;
    
    cards.forEach((card, index) => {
      html += `
        <div class="flashcard mb-4" id="card-${index}">
          <div class="card-inner">
            <div class="card-front p-6 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-center min-h-32">
              <p class="text-center">${card.front}</p>
            </div>
            <div class="card-back p-6 bg-green-50 border border-green-200 rounded-lg hidden flex items-center justify-center min-h-32">
              <p class="text-center">${card.back}</p>
            </div>
          </div>
          <button class="flip-card-btn btn btn-secondary mt-2 w-full">Flip Card</button>
        </div>
      `;
    });
    
    html += `
        </div>
        <script>
          document.querySelectorAll('.flip-card-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              const card = this.closest('.flashcard');
              const front = card.querySelector('.card-front');
              const back = card.querySelector('.card-back');
              
              if (front.classList.contains('hidden')) {
                front.classList.remove('hidden');
                back.classList.add('hidden');
                this.textContent = 'Flip Card';
              } else {
                front.classList.add('hidden');
                back.classList.remove('hidden');
                this.textContent = 'Back to Question';
              }
            });
          });
        </script>
      </div>
    `;
    
    return html;
  }
  
  _generateTimelineHTML(events = []) {
    if (!events || events.length === 0) {
      events = [
        { date: '2000', title: 'Sample Event', description: 'Description of event' }
      ];
    }
    
    let html = `
      <div class="timeline-container p-4 bg-white rounded-lg shadow">
        <h3 class="text-xl font-bold mb-4">Timeline</h3>
        <div class="timeline relative">
    `;
    
    events.forEach((event, index) => {
      html += `
        <div class="timeline-item mb-8 relative pl-8 border-l-2 border-blue-500">
          <div class="timeline-marker absolute -left-1.5 top-1.5 w-3 h-3 bg-blue-500 rounded-full"></div>
          <div class="timeline-date font-bold text-blue-700">${event.date}</div>
          <div class="timeline-title text-lg font-semibold">${event.title}</div>
          <div class="timeline-description text-gray-700">${event.description}</div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }
}

// Create and export the service
window.openaiService = new OpenAIService();
