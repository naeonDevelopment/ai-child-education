// HeyGen Integration Service
// Provides interactive avatar generation for AI agents

class HeyGenService {
  constructor() {
    this.apiUrl = window.appConfig.heygen.apiUrl;
    this.apiKey = window.appConfig.heygen.apiKey;
    this.activeStreams = new Map();
  }

  // Generate a video with an avatar speaking the provided text
  async generateVideo(text, avatarId, options = {}) {
    try {
      const requestId = this._generateRequestId();
      
      const response = await fetch(`${this.apiUrl}/text-to-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          avatar_id: avatarId,
          voice_id: options.voiceId || 'en-US-female-1',
          background_image_url: options.backgroundImageUrl || null,
          background_color: options.backgroundColor || "#000000",
          webhook_url: options.webhookUrl || null,
          video_type: options.videoType || "classic", // classic or stitch
          style: options.style || "normal", // normal, happy, sad
          request_id: requestId
        })
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // If the video generation is async, poll for status
      if (data.data?.status === 'pending' || data.data?.status === 'processing') {
        return this._pollVideoStatus(data.data.video_id);
      }
      
      return {
        success: true,
        videoId: data.data?.video_id,
        videoUrl: data.data?.video_url,
        status: data.data?.status
      };
    } catch (error) {
      console.error('Error generating HeyGen video:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Start a streaming session with an avatar
  async startStreaming(avatarId, options = {}) {
    try {
      const sessionId = this._generateRequestId();
      
      const response = await fetch(`${this.apiUrl}/streaming/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify({
          avatar_id: avatarId,
          voice_id: options.voiceId || 'en-US-female-1',
          background_image_url: options.backgroundImageUrl || null,
          background_color: options.backgroundColor || "#000000",
          session_id: sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store active stream
      this.activeStreams.set(sessionId, {
        avatarId,
        sessionId: data.data?.session_id || sessionId,
        status: data.data?.status || 'unknown'
      });
      
      return {
        success: true,
        sessionId: data.data?.session_id || sessionId,
        status: data.data?.status,
        streamUrl: data.data?.stream_url
      };
    } catch (error) {
      console.error('Error starting HeyGen streaming:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send text to be spoken by avatar in streaming session
  async streamText(sessionId, text, options = {}) {
    if (!this.activeStreams.has(sessionId)) {
      return {
        success: false,
        error: 'Streaming session not found'
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/streaming/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify({
          session_id: sessionId,
          text: text,
          emotion: options.emotion || 'neutral', // neutral, happy, sad, angry, fear, surprise
          voice_id: options.voiceId || null // Optional override for session voice
        })
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        requestId: data.data?.request_id,
        status: data.data?.status
      };
    } catch (error) {
      console.error('Error streaming text to HeyGen:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // End a streaming session
  async endStreaming(sessionId) {
    if (!this.activeStreams.has(sessionId)) {
      return {
        success: false,
        error: 'Streaming session not found'
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/streaming/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.statusText}`);
      }

      // Remove from active streams
      this.activeStreams.delete(sessionId);
      
      return {
        success: true,
        message: 'Streaming session ended'
      };
    } catch (error) {
      console.error('Error ending HeyGen streaming:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get available avatars
  async getAvatars() {
    try {
      const response = await fetch(`${this.apiUrl}/avatars`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`HeyGen API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        avatars: data.data?.avatars || []
      };
    } catch (error) {
      console.error('Error fetching HeyGen avatars:', error);
      return {
        success: false,
        error: error.message,
        avatars: []
      };
    }
  }

  // Helper to poll for video generation status
  async _pollVideoStatus(videoId, maxAttempts = 30) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      
      const checkStatus = async () => {
        try {
          const response = await fetch(`${this.apiUrl}/videos/${videoId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': this.apiKey
            }
          });
          
          if (!response.ok) {
            clearInterval(intervalId);
            reject(new Error(`HeyGen API error: ${response.statusText}`));
          }
          
          const data = await response.json();
          
          if (data.data?.status === 'complete') {
            clearInterval(intervalId);
            resolve({
              success: true,
              videoId: data.data.video_id,
              videoUrl: data.data.video_url,
              status: 'complete'
            });
          } else if (data.data?.status === 'failed') {
            clearInterval(intervalId);
            reject(new Error('Video generation failed'));
          }
          
          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(intervalId);
            reject(new Error('Timeout waiting for video generation'));
          }
        } catch (error) {
          clearInterval(intervalId);
          reject(error);
        }
      };
      
      // Check every 2 seconds
      const intervalId = setInterval(checkStatus, 2000);
      
      // Initial check
      checkStatus();
    });
  }

  // Generate a unique request ID
  _generateRequestId() {
    return 'req_' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}

// Create and export the service
window.heygenService = new HeyGenService();
