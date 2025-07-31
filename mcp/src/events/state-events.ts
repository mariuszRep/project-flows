import { EventEmitter } from 'events';

export interface StateChangeEvent {
  type: 'state_change';
  key: string;
  value: any;
  timestamp: string;
  source_client: string;
  [key: string]: unknown; // Make it compatible with MCP notification params
}

class StateEventEmitter extends EventEmitter {
  broadcastStateChange(event: StateChangeEvent): void {
    this.emit('state_change', event);
  }
}

// Global singleton instance
export const stateEvents = new StateEventEmitter();