class WebSocketManager {
  constructor() {
    this.ws = null;
    this.token = null;
    this.listeners = {
      metricsUpdate: [],
      dataResponse: [],
      error: [],
      connected: [],
      disconnected: [],
    };
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }

  /**
   * Connect to WebSocket server
   */
  connect(token) {
    this.token = token;
    const wsUrl = `ws://localhost:8000/ws?token=${token}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
        this.sendPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.emit('disconnected');
        this.attemptReconnect();
      };
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      this.emit('error', err);
    }
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    switch (message.type) {
      case 'metrics_update':
        this.emit('metricsUpdate', message);
        break;
      case 'data_response':
        this.emit('dataResponse', message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Send ping to keep connection alive
   */
  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send('ping');
      setTimeout(() => this.sendPing(), 30000); // Ping every 30 seconds
    }
  }

  /**
   * Request data from server
   */
  requestData() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send('get_data');
    }
  }

  /**
   * Subscribe to event
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Unsubscribe from event
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emit event to all listeners
   */
  emit(event, data = null) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in listener for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnecting... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect(this.token);
      }, this.reconnectDelay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      this.emit('error', new Error('Failed to reconnect'));
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketManager();