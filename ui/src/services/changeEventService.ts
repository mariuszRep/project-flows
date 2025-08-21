/**
 * Cross-tab event system for broadcasting data changes between browser tabs
 * Uses BroadcastChannel API for cross-tab communication
 */
class ChangeEventService {
  private listeners: Map<string, Set<() => void>> = new Map();
  private broadcastChannel: BroadcastChannel;

  constructor() {
    // Create broadcast channel for cross-tab communication
    this.broadcastChannel = new BroadcastChannel('task_updates');
    
    // Listen for messages from other tabs
    this.broadcastChannel.addEventListener('message', (event) => {
      console.log('Received cross-tab event:', event.data);
      this.handleCrossTabEvent(event.data);
    });
  }

  private handleCrossTabEvent(data: { eventType: string }) {
    // Trigger local listeners for events from other tabs
    const eventListeners = this.listeners.get(data.eventType);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener();
        } catch (error) {
          console.error(`Error in cross-tab ${data.eventType} listener:`, error);
        }
      });
    }
  }

  // Emit an event to notify listeners in this tab AND other tabs
  emit(eventType: 'task_changed' | 'project_changed' | 'data_changed') {
    console.log(`Emitting event: ${eventType}`);
    
    // Notify listeners in current tab
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener();
        } catch (error) {
          console.error(`Error in ${eventType} listener:`, error);
        }
      });
    }

    // Broadcast to other tabs
    try {
      this.broadcastChannel.postMessage({ eventType });
      console.log(`Broadcasted ${eventType} to other tabs`);
    } catch (error) {
      console.error('Error broadcasting to other tabs:', error);
    }
  }

  // Subscribe to events
  on(eventType: 'task_changed' | 'project_changed' | 'data_changed', callback: () => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    // Return cleanup function
    return () => {
      const eventListeners = this.listeners.get(eventType);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(eventType);
        }
      }
    };
  }

  // Get number of listeners for debugging
  getListenerCount(eventType: string): number {
    return this.listeners.get(eventType)?.size || 0;
  }

  // Clear all listeners
  clear() {
    this.listeners.clear();
  }

  // Cleanup - close broadcast channel
  destroy() {
    this.broadcastChannel.close();
    this.listeners.clear();
  }
}

// Global instance
export const changeEventService = new ChangeEventService();

// Optional: cleanup when window is closed
window.addEventListener('beforeunload', () => {
  changeEventService.destroy();
});