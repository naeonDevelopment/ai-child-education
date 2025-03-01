// Perplexity Integration Service
// Provides research capabilities and up-to-date information for educational content

class PerplexityService {
  constructor() {
    this.apiUrl = window.appConfig.perplexity.apiUrl;
    this.apiKey = window.appConfig.perplexity.apiKey;
  }

  // Perform a search query using Perplexity
  async search(query, options = {}) {
    try {
      const model = options.model || 'pplx-7b-online';
      const maxTokens = options.maxTokens || 1000;
      
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are a research assistant for an educational platform for children. Provide accurate, age-appropriate information.'
            },
            {
              role: 'user',
              content: query
            }
          ],
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.choices[0]?.message?.content || '',
        success: true
      };
    } catch (error) {
      console.error('Error querying Perplexity:', error);
      return {
        content: 'I apologize, but I couldn\'t find that information right now.',
        success: false,
        error: error.message
      };
    }
  }

  // Ask a specific educational question
  async askEducationalQuestion(question, ageGroup, options = {}) {
    try {
      const model = options.model || 'pplx-7b-online';
      const maxTokens = options.maxTokens || 1000;
      
      // Format the prompt to be age-appropriate
      let systemPrompt = 'You are an educational assistant helping children learn. ';
      
      if (ageGroup === 'young') {
        systemPrompt += 'Explain concepts in very simple terms suitable for children aged 5-8. Use short sentences and everyday examples.';
      } else if (ageGroup === 'middle') {
        systemPrompt += 'Explain concepts clearly for children aged 9-12. Use analogies and examples they can relate to.';
      } else if (ageGroup === 'teen') {
        systemPrompt += 'Provide explanations suitable for teenagers aged 13-16. You can introduce more complex concepts but make them engaging.';
      } else {
        systemPrompt += 'Provide clear, engaging explanations with examples.';
      }
      
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: question
            }
          ],
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.choices[0]?.message?.content || '',
        success: true
      };
    } catch (error) {
      console.error('Error querying Perplexity for educational content:', error);
      return {
        content: 'I apologize, but I couldn\'t find that information right now.',
        success: false,
        error: error.message
      };
    }
  }

  // Research a specific topic for educational content
  async researchTopic(topic, options = {}) {
    try {
      const model = options.model || 'pplx-7b-online';
      const maxTokens = options.maxTokens || 2000;
      const ageGroup = options.ageGroup || 'middle';
      
      // Create a structured research prompt
      let researchPrompt = `I need to create educational content about "${topic}" for children. `;
      
      if (ageGroup === 'young') {
        researchPrompt += 'The content is for children aged 5-8. Focus on basic concepts, use simple language, and include fun facts.';
      } else if (ageGroup === 'middle') {
        researchPrompt += 'The content is for children aged 9-12. Include interesting details, examples, and some historical context if relevant.';
      } else if (ageGroup === 'teen') {
        researchPrompt += 'The content is for teenagers aged 13-16. Include more detailed explanations, real-world applications, and thought-provoking questions.';
      }
      
      researchPrompt += ' Please provide: 1) A brief introduction to the topic, 2) 3-5 key points or concepts, 3) Real-world examples or applications, 4) 2-3 interesting facts that might surprise children, 5) A suggestion for an interactive activity related to this topic.';
      
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: 'You are an educational content researcher. Provide accurate, engaging, and age-appropriate information structured in the format requested.'
            },
            {
              role: 'user',
              content: researchPrompt
            }
          ],
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        content: data.choices[0]?.message?.content || '',
        success: true
      };
    } catch (error) {
      console.error('Error researching topic with Perplexity:', error);
      return {
        content: 'I apologize, but I couldn\'t research that topic right now.',
        success: false,
        error: error.message
      };
    }
  }
}

// Create and export the service
window.perplexityService = new PerplexityService();
