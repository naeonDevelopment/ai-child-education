// Configuration values for the application
// In a production environment, these would be loaded from environment variables

const config = {
  // Supabase configuration
  supabase: {
    url: 'https://uroqpfjxfxqkxtyiaqxt.supabase.co',
    publicKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyb3VwZmp4Znhxa3h0eWlhcXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4MjE5NjYsImV4cCI6MjA1NjM5Nzk2Nn0.ByL7cuphflfM_GHzkWuI12mTcC5VnadUykHu9-FR_lc'
  },

  // OpenAI configuration 
  openai: {
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o'
  },

  // HeyGen configuration
  heygen: {
    apiUrl: 'https://api.heygen.com/v1',
    apiKey: 'ZTYwYjUzOTk5MzcyNGNmNGExNTRhMmUwNzAxOWJiYTEtMTY5Njg1NzY4Ng=='
  },

  // Zep memory configuration
  zep: {
    apiUrl: 'https://api.zep.ai/api',
    apiKey: 'z_1dWlkIjoiNGU5NGQ3ZDItYTM2ZS00N2RiLTlhY2ItMjZmY2Y2NmJjYjZkIn0.OakOQRI6JOSVzUGPJtRUKsXSVcEG438fH2XXqsp0IsKV4IJMxgMzr7rFWWIcZvk6SgfSs-WelfnzYGTPqPvswQ'
  },

  // Perplexity configuration
  perplexity: {
    apiUrl: 'https://api.perplexity.ai',
    apiKey: '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'
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
      initial: 'M',
      heygenAvatarId: 'avatar_1' // Replace with actual HeyGen avatar ID
    },
    science: {
      name: 'Science Explorer',
      description: 'Let\'s discover how things work',
      avatarBg: 'bg-green-100', 
      textColor: 'text-green-600', 
      initial: 'S',
      heygenAvatarId: 'avatar_2' // Replace with actual HeyGen avatar ID
    },
    creativity: {
      name: 'Creative Coach',
      description: 'Let\'s make something amazing',
      avatarBg: 'bg-purple-100', 
      textColor: 'text-purple-600', 
      initial: 'C',
      heygenAvatarId: 'avatar_3' // Replace with actual HeyGen avatar ID
    },
    critical_thinking: {
      name: 'Thinking Guide',
      description: 'Let\'s solve problems together',
      avatarBg: 'bg-yellow-100', 
      textColor: 'text-yellow-600', 
      initial: 'T',
      heygenAvatarId: 'avatar_4' // Replace with actual HeyGen avatar ID
    }
  }
};

// IMPORTANT NOTE: In a production environment, API keys should NEVER be exposed in client-side code.
// This is for demonstration purposes only.
// In a real application, these API calls would be made through a secure backend service.

// Make the config available globally
window.appConfig = config;
