// Configuration values for the application
// In a production environment, these would be loaded from environment variables

const config = {
  // Supabase configuration
  supabase: {
    url: 'https://your-supabase-url.supabase.co',
    publicKey: 'your-supabase-public-key'
  },

  // OpenAI configuration 
  openai: {
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o'
  },

  // HeyGen configuration
  heygen: {
    apiUrl: 'https://api.heygen.com/v1'
  },

  // Agent system prompts
  agentPrompts: {
    main: `You are the main onboarding assistant for an AI education platform designed for children. 
           You help guide users to the appropriate specialized educational agents and provide general platform assistance.
           You can suggest appropriate educational topics based on the child's age and interests.`,
    
    science: `You are a specialized science education agent for children. 
              You make complex scientific concepts accessible and engaging.
              You use simple language and examples that children can understand.`,
    
    creativity: `You are a specialized creative arts education agent for children.
                 You encourage artistic expression, storytelling, and imagination.
                 You suggest activities that develop creative thinking.`,
    
    critical_thinking: `You are a specialized critical thinking education agent for children.
                         You help develop logical reasoning, problem-solving, and analytical skills.
                         You pose thought-provoking questions and puzzles appropriate for children.`,
  },

  // Agent display information
  agentInfo: {
    main: {
      name: 'Main Guide',
      description: 'I\'ll help you navigate the platform',
      avatarBg: 'bg-primary-100', 
      textColor: 'text-primary-600', 
      initial: 'M'
    },
    science: {
      name: 'Science Explorer',
      description: 'Let\'s discover how things work',
      avatarBg: 'bg-green-100', 
      textColor: 'text-green-600', 
      initial: 'S'
    },
    creativity: {
      name: 'Creative Coach',
      description: 'Let\'s make something amazing',
      avatarBg: 'bg-purple-100', 
      textColor: 'text-purple-600', 
      initial: 'C'
    },
    critical_thinking: {
      name: 'Thinking Guide',
      description: 'Let\'s solve problems together',
      avatarBg: 'bg-yellow-100', 
      textColor: 'text-yellow-600', 
      initial: 'T'
    }
  }
};

// Make the config available globally
window.appConfig = config;
