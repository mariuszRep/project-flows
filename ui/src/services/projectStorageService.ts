/**
 * Project storage service for cross-tab project selection synchronization
 */

export interface StorageEvent {
  key: string;
  value: any;
  timestamp: string;
}

class ProjectStorageService {
  private listeners: Map<string, Array<(value: any) => void>> = new Map();
  private broadcastChannel: BroadcastChannel;

  constructor() {
    // Use BroadcastChannel for cross-tab communication
    this.broadcastChannel = new BroadcastChannel('project-selection');
    this.broadcastChannel.addEventListener('message', this.handleBroadcastMessage.bind(this));

    // Also listen to storage events as fallback
    window.addEventListener('storage', this.handleStorageEvent.bind(this));
  }

  private handleBroadcastMessage(event: MessageEvent) {
    if (event.data && event.data.key === 'selectedProjectId') {
      this.notifyListeners('selectedProjectId', event.data.value);
    }
  }

  private handleStorageEvent(event: StorageEvent) {
    if (event.key === 'selectedProjectId') {
      const value = event.newValue ? JSON.parse(event.newValue) : null;
      this.notifyListeners('selectedProjectId', value);
    }
  }

  private notifyListeners(key: string, value: any) {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => listener(value));
    }
  }

  setSelectedProjectId(projectId: number | null): void {
    // Update localStorage
    if (projectId !== null) {
      localStorage.setItem('selectedProjectId', JSON.stringify(projectId));
    } else {
      localStorage.removeItem('selectedProjectId');
    }

    // Broadcast to other tabs
    this.broadcastChannel.postMessage({
      key: 'selectedProjectId',
      value: projectId,
      timestamp: new Date().toISOString()
    });
  }

  getSelectedProjectId(): number | null {
    const stored = localStorage.getItem('selectedProjectId');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  subscribe(key: string, listener: (value: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(listener);

    // Return unsubscribe function
    return () => {
      const keyListeners = this.listeners.get(key);
      if (keyListeners) {
        const index = keyListeners.indexOf(listener);
        if (index > -1) {
          keyListeners.splice(index, 1);
        }
      }
    };
  }

  cleanup(): void {
    this.broadcastChannel.close();
    window.removeEventListener('storage', this.handleStorageEvent.bind(this));
  }
}

export const projectStorageService = new ProjectStorageService();