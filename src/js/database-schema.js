// Database Schema for AI Child Education Platform
// This file defines the schema and initialization functions for Supabase

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.initialized = false;
  }

  // Initialize the database connection
  async initialize() {
    if (this.initialized) return true;

    try {
      // Get Supabase instance from global context
      if (!window.supabase) {
        console.error('Supabase client not found in global context');
        return false;
      }

      this.supabase = window.supabase.createClient(
        window.appConfig.supabase.url,
        window.appConfig.supabase.publicKey
      );

      // Initialize schema if needed (this would be done in a backend migration in production)
      await this._ensureSchemaExists();
      
      this.initialized = true;
      console.log('Database initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing database:', error);
      return false;
    }
  }

  // Ensure the database schema exists
  async _ensureSchemaExists() {
    try {
      // Check if tables exist
      const { data: existingTables, error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (error) {
        console.error('Error checking existing tables:', error);
        return false;
      }

      const tableNames = existingTables.map(t => t.table_name);
      const requiredTables = [
        'user_profiles',
        'learning_sessions',
        'learning_progress',
        'educational_content',
        'agent_interactions',
        'swarm_nodes',
        'thought_connections'
      ];

      // Create any missing tables (in real app, this would be handled by migrations)
      // For development purposes, we'll check and create tables as needed
      for (const tableName of requiredTables) {
        if (!tableNames.includes(tableName)) {
          await this._createTable(tableName);
        }
      }

      return true;
    } catch (error) {
      console.error('Error ensuring schema exists:', error);
      return false;
    }
  }

  // Create a table based on predefined schema
  async _createTable(tableName) {
    console.log(`Creating table: ${tableName}`);

    const tableDefinitions = {
      // User profiles extending auth.users
      user_profiles: {
        create: `
          CREATE TABLE IF NOT EXISTS public.user_profiles (
            id UUID REFERENCES auth.users(id) PRIMARY KEY,
            display_name TEXT,
            age_range TEXT CHECK (age_range IN ('5-8', '9-12', '13-16', '17+')),
            interests TEXT[],
            learning_preferences JSONB,
            avatar_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
          
          -- Set up Row Level Security
          ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
          
          -- Policy: Users can read/write their own profile
          CREATE POLICY "Users can read their own profile"
            ON public.user_profiles FOR SELECT
            USING (auth.uid() = id);
          
          CREATE POLICY "Users can update their own profile"
            ON public.user_profiles FOR UPDATE
            USING (auth.uid() = id);
          
          -- Trigger for updated_at
          CREATE OR REPLACE FUNCTION update_updated_at_column()
          RETURNS TRIGGER AS $$
          BEGIN
            NEW.updated_at = now();
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
          
          CREATE TRIGGER update_user_profiles_updated_at
            BEFORE UPDATE ON public.user_profiles
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
        `
      },
      
      // Learning sessions tracking
      learning_sessions: {
        create: `
          CREATE TABLE IF NOT EXISTS public.learning_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES auth.users(id) NOT NULL,
            agent_id TEXT NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            ended_at TIMESTAMP WITH TIME ZONE,
            topics_covered TEXT[],
            session_summary TEXT,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
          
          -- Set up Row Level Security
          ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
          
          -- Policy: Users can read their own sessions
          CREATE POLICY "Users can read their own sessions"
            ON public.learning_sessions FOR SELECT
            USING (auth.uid() = user_id);
          
          -- Policy: Users can insert their own sessions
          CREATE POLICY "Users can insert their own sessions"
            ON public.learning_sessions FOR INSERT
            WITH CHECK (auth.uid() = user_id);
          
          -- Policy: Users can update their own sessions
          CREATE POLICY "Users can update their own sessions"
            ON public.learning_sessions FOR UPDATE
            USING (auth.uid() = user_id);
          
          -- Trigger for updated_at
          CREATE TRIGGER update_learning_sessions_updated_at
            BEFORE UPDATE ON public.learning_sessions
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
        `
      },
      
      // Learning progress tracking
      learning_progress: {
        create: `
          CREATE TABLE IF NOT EXISTS public.learning_progress (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES auth.users(id) NOT NULL,
            topic_id TEXT NOT NULL,
            proficiency_level INTEGER CHECK (proficiency_level BETWEEN 0 AND 5),
            interactions_count INTEGER DEFAULT 0,
            last_interaction TIMESTAMP WITH TIME ZONE DEFAULT now(),
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            UNIQUE(user_id, topic_id)
          );
          
          -- Set up Row Level Security
          ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;
          
          -- Policy: Users can read their own progress
          CREATE POLICY "Users can read their own progress"
            ON public.learning_progress FOR SELECT
            USING (auth.uid() = user_id);
          
          -- Policy: Users can insert their own progress
          CREATE POLICY "Users can insert their own progress"
            ON public.learning_progress FOR INSERT
            WITH CHECK (auth.uid() = user_id);
          
          -- Policy: Users can update their own progress
          CREATE POLICY "Users can update their own progress"
            ON public.learning_progress FOR UPDATE
            USING (auth.uid() = user_id);
          
          -- Trigger for updated_at
          CREATE TRIGGER update_learning_progress_updated_at
            BEFORE UPDATE ON public.learning_progress
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
        `
      },
      
      // Educational content catalog
      educational_content: {
        create: `
          CREATE TABLE IF NOT EXISTS public.educational_content (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            topic_id TEXT NOT NULL,
            content_type TEXT CHECK (content_type IN ('lesson', 'quiz', 'activity', 'discussion', 'resource')),
            title TEXT NOT NULL,
            description TEXT,
            age_range TEXT[] CHECK (age_range <@ ARRAY['5-8', '9-12', '13-16', '17+']),
            difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
            content_data JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
          
          -- Set up Row Level Security
          ALTER TABLE public.educational_content ENABLE ROW LEVEL SECURITY;
          
          -- Policy: Anyone can read educational content
          CREATE POLICY "Anyone can read educational content"
            ON public.educational_content FOR SELECT
            USING (true);
          
          -- Trigger for updated_at
          CREATE TRIGGER update_educational_content_updated_at
            BEFORE UPDATE ON public.educational_content
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
        `
      },
      
      // Agent interactions for swarm intelligence
      agent_interactions: {
        create: `
          CREATE TABLE IF NOT EXISTS public.agent_interactions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            session_id UUID REFERENCES public.learning_sessions(id),
            user_id UUID REFERENCES auth.users(id) NOT NULL,
            agent_id TEXT NOT NULL,
            message_content TEXT NOT NULL,
            response_content TEXT,
            tools_used JSONB,
            interaction_metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
          
          -- Set up Row Level Security
          ALTER TABLE public.agent_interactions ENABLE ROW LEVEL SECURITY;
          
          -- Policy: Users can read their own interactions
          CREATE POLICY "Users can read their own interactions"
            ON public.agent_interactions FOR SELECT
            USING (auth.uid() = user_id);
          
          -- Policy: Users can insert their own interactions
          CREATE POLICY "Users can insert their own interactions"
            ON public.agent_interactions FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        `
      },
      
      // Swarm nodes for parallel processing
      swarm_nodes: {
        create: `
          CREATE TABLE IF NOT EXISTS public.swarm_nodes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            session_id UUID REFERENCES public.learning_sessions(id),
            user_id UUID REFERENCES auth.users(id) NOT NULL,
            node_type TEXT NOT NULL,
            node_content TEXT NOT NULL,
            active BOOLEAN DEFAULT true,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
          
          -- Set up Row Level Security
          ALTER TABLE public.swarm_nodes ENABLE ROW LEVEL SECURITY;
          
          -- Policy: Users can read their own swarm nodes
          CREATE POLICY "Users can read their own swarm nodes"
            ON public.swarm_nodes FOR SELECT
            USING (auth.uid() = user_id);
          
          -- Trigger for updated_at
          CREATE TRIGGER update_swarm_nodes_updated_at
            BEFORE UPDATE ON public.swarm_nodes
            FOR EACH ROW
            EXECUTE PROCEDURE update_updated_at_column();
        `
      },
      
      // Connections between thoughts in the network
      thought_connections: {
        create: `
          CREATE TABLE IF NOT EXISTS public.thought_connections (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            source_node_id UUID REFERENCES public.swarm_nodes(id) NOT NULL,
            target_node_id UUID REFERENCES public.swarm_nodes(id) NOT NULL,
            connection_type TEXT NOT NULL,
            connection_strength FLOAT CHECK (connection_strength BETWEEN 0 AND 1),
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            UNIQUE(source_node_id, target_node_id)
          );
          
          -- Set up Row Level Security
          ALTER TABLE public.thought_connections ENABLE ROW LEVEL SECURITY;
          
          -- Policy: Users can read connections if they own either node
          CREATE POLICY "Users can read their connections"
            ON public.thought_connections FOR SELECT
            USING (
              EXISTS (
                SELECT 1 FROM public.swarm_nodes 
                WHERE (id = source_node_id OR id = target_node_id) 
                AND user_id = auth.uid()
              )
            );
        `
      }
    };

    // Check if the table definition exists
    if (!tableDefinitions[tableName]) {
      console.error(`No table definition found for: ${tableName}`);
      return false;
    }

    // Create the table
    try {
      // In a real application, we would use database migrations
      // For our demo, we're simulating this with a direct SQL query
      // In production, Supabase doesn't allow arbitrary SQL queries from the client
      console.log(`Table ${tableName} would be created with SQL: ${tableDefinitions[tableName].create}`);
      
      // Instead, we'll log that this would normally be handled by a backend service
      console.log(`Note: In production, database migrations would be handled server-side`);
      
      return true;
    } catch (error) {
      console.error(`Error creating table ${tableName}:`, error);
      return false;
    }
  }

  // CRUD operations for user profiles
  
  async getUserProfile(userId) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  async createUserProfile(profileData) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .insert([profileData])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error creating user profile:', error);
      return null;
    }
  }

  async updateUserProfile(userId, profileData) {
    try {
      const { data, error } = await this.supabase
        .from('user_profiles')
        .update(profileData)
        .eq('id', userId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error updating user profile:', error);
      return null;
    }
  }

  // Learning sessions management
  
  async startLearningSession(userId, agentId) {
    try {
      const { data, error } = await this.supabase
        .from('learning_sessions')
        .insert([{
          user_id: userId,
          agent_id: agentId,
          started_at: new Date().toISOString(),
          topics_covered: [],
          metadata: {}
        }])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error starting learning session:', error);
      return null;
    }
  }

  async endLearningSession(sessionId, summary = '', topicsCovered = []) {
    try {
      const { data, error } = await this.supabase
        .from('learning_sessions')
        .update({
          ended_at: new Date().toISOString(),
          session_summary: summary,
          topics_covered: topicsCovered
        })
        .eq('id', sessionId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error ending learning session:', error);
      return null;
    }
  }

  async getRecentLearningSessions(userId, limit = 5) {
    try {
      const { data, error } = await this.supabase
        .from('learning_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting recent learning sessions:', error);
      return [];
    }
  }

  // Swarm-based orchestration tables
  
  async createSwarmNode(sessionId, userId, nodeType, nodeContent, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('swarm_nodes')
        .insert([{
          session_id: sessionId,
          user_id: userId,
          node_type: nodeType,
          node_content: nodeContent,
          active: true,
          metadata: metadata
        }])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error creating swarm node:', error);
      return null;
    }
  }

  async connectThoughts(sourceNodeId, targetNodeId, connectionType, connectionStrength = 0.5, metadata = {}) {
    try {
      const { data, error } = await this.supabase
        .from('thought_connections')
        .insert([{
          source_node_id: sourceNodeId,
          target_node_id: targetNodeId,
          connection_type: connectionType,
          connection_strength: connectionStrength,
          metadata: metadata
        }])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error connecting thoughts:', error);
      return null;
    }
  }

  async getActiveSwarmNodes(sessionId) {
    try {
      const { data, error } = await this.supabase
        .from('swarm_nodes')
        .select('*')
        .eq('session_id', sessionId)
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting active swarm nodes:', error);
      return [];
    }
  }

  async getConnectedThoughts(nodeId) {
    try {
      const { data, error } = await this.supabase
        .from('thought_connections')
        .select(`
          id,
          connection_type,
          connection_strength,
          metadata,
          source_node:source_node_id(id, node_type, node_content, metadata),
          target_node:target_node_id(id, node_type, node_content, metadata)
        `)
        .or(`source_node_id.eq.${nodeId},target_node_id.eq.${nodeId}`);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting connected thoughts:', error);
      return [];
    }
  }

  // Learning progress tracking
  
  async updateLearningProgress(userId, topicId, proficiencyLevel) {
    try {
      // Check if record exists
      const { data: existingData, error: existingError } = await this.supabase
        .from('learning_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('topic_id', topicId)
        .single();

      if (existingError && existingError.code !== 'PGRST116') {
        throw existingError;
      }

      if (existingData) {
        // Update existing record
        const { data, error } = await this.supabase
          .from('learning_progress')
          .update({
            proficiency_level: proficiencyLevel,
            interactions_count: existingData.interactions_count + 1,
            last_interaction: new Date().toISOString()
          })
          .eq('id', existingData.id)
          .select();

        if (error) throw error;
        return data[0];
      } else {
        // Create new record
        const { data, error } = await this.supabase
          .from('learning_progress')
          .insert([{
            user_id: userId,
            topic_id: topicId,
            proficiency_level: proficiencyLevel,
            interactions_count: 1,
            last_interaction: new Date().toISOString()
          }])
          .select();

        if (error) throw error;
        return data[0];
      }
    } catch (error) {
      console.error('Error updating learning progress:', error);
      return null;
    }
  }

  async getLearningProgress(userId) {
    try {
      const { data, error } = await this.supabase
        .from('learning_progress')
        .select('*')
        .eq('user_id', userId)
        .order('last_interaction', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting learning progress:', error);
      return [];
    }
  }
}

// Create and export the service
window.databaseService = new DatabaseService();
