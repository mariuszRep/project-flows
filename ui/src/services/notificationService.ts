import { changeEventService } from './changeEventService';

interface NotificationEvent {
  type: string;
  key: string;
  value: any;
  timestamp: string;
  source_client?: string;
}

class NotificationService {
  private eventSource: EventSource | null = null;
  private serverUrl: string = '';
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;
  private isConnecting: boolean = false;

  /**
   * Connect to the notification stream from the MCP server
   * @param serverUrl The base URL of the MCP server
   */
  connect(serverUrl: string): void {
    if (this.isConnecting) return;
    this.isConnecting = true;
    
    try {
      // Close any existing connection
      this.disconnect();
      
      // Store server URL for reconnection
      this.serverUrl = serverUrl;
      
      // Create notification endpoint URL
      const notificationUrl = new URL(serverUrl);
      notificationUrl.pathname = '/notifications';
      notificationUrl.searchParams.set('client', 'ui-notification-client');
      
      console.log(`Connecting to notification stream at ${notificationUrl.toString()}`);
      
      // Create EventSource for SSE connection
      this.eventSource = new EventSource(notificationUrl.toString());
      
      // Set up event handlers
      this.eventSource.onopen = this.handleOpen.bind(this);
      this.eventSource.onerror = this.handleError.bind(this);
      this.eventSource.onmessage = this.handleMessage.bind(this);
      
      // Set up specific event handlers
      this.eventSource.addEventListener('state_change', this.handleStateChange.bind(this));
      this.eventSource.addEventListener('connected', this.handleConnected.bind(this));
      this.eventSource.addEventListener('ping', this.handlePing.bind(this));
    } catch (error) {
      console.error('Error connecting to notification stream:', error);
      this.scheduleReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from the notification stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Handle successful connection
   */
  private handleOpen(event: Event): void {
    console.log('Notification stream connected');
    this.reconnectAttempts = 0;
  }

  /**
   * Handle connection errors
   */
  private handleError(event: Event): void {
    console.error('Notification stream error:', event);
    this.disconnect();
    this.scheduleReconnect();
  }

  /**
   * Handle generic messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('Notification message received:', data);
    } catch (error) {
      console.error('Error parsing notification message:', error);
    }
  }

  /**
   * Handle state change events
   */
  private handleStateChange(event: MessageEvent): void {
    try {
      const stateChange = JSON.parse(event.data) as NotificationEvent;
      
      if (stateChange.key === 'data_changed') {
        const dataChange = stateChange.value;
        console.log('Received data change notification:', dataChange);
        
        // Trigger appropriate client-side events based on the object_type
        if (dataChange.object_type === 'task') {
          console.log('Task change detected, emitting task_changed event');
          changeEventService.emit('task_changed');
          changeEventService.emit('data_changed');
        } else if (dataChange.object_type === 'project') {
          console.log('Project change detected, emitting project_changed event');
          changeEventService.emit('project_changed');
          changeEventService.emit('data_changed');
        } else {
          // Generic data change
          console.log('Generic data change detected, emitting data_changed event');
          changeEventService.emit('data_changed');
        }
      }
    } catch (error) {
      console.error('Error handling state change notification:', error);
    }
  }

  /**
   * Handle connected event
   */
  private handleConnected(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('Notification connection established:', data);
    } catch (error) {
      console.error('Error parsing connected notification:', error);
    }
  }

  /**
   * Handle ping event
   */
  private handlePing(event: MessageEvent): void {
    // Server sent a ping to keep the connection alive
    // No action needed, but we can log it for debugging
    console.debug('Notification ping received');
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Failed to reconnect after ${this.maxReconnectAttempts} attempts`);
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Scheduling notification reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.serverUrl) {
        this.connect(this.serverUrl);
      }
    }, delay);
  }
}

export const notificationService = new NotificationService();
