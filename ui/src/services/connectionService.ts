import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CONNECTION_LOST = 'connection_lost',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

export interface ConnectionProgress {
  state: ConnectionState;
  attempt: number;
  maxAttempts: number;
  nextRetryIn?: number;
  error?: string;
}

export interface ConnectionResult {
  success: boolean;
  client?: Client;
  tools?: any[];
  error?: string;
}

export const connectionService = {
  async connectWithRetry(
    serverUrl: string,
    maxAttempts: number = 5,
    onProgress?: (progress: ConnectionProgress) => void
  ): Promise<ConnectionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        onProgress?.({
          state: ConnectionState.CONNECTING,
          attempt,
          maxAttempts,
        });

        const result = await this.attemptConnection(serverUrl);
        
        onProgress?.({
          state: ConnectionState.CONNECTED,
          attempt,
          maxAttempts,
        });

        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Connection attempt ${attempt}/${maxAttempts} failed:`, error);

        if (attempt < maxAttempts) {
          const delay = this.getRetryDelay(attempt);
          
          onProgress?.({
            state: ConnectionState.RECONNECTING,
            attempt,
            maxAttempts,
            nextRetryIn: delay,
            error: lastError.message,
          });

          await this.delay(delay);
        }
      }
    }

    onProgress?.({
      state: ConnectionState.FAILED,
      attempt: maxAttempts,
      maxAttempts,
      error: lastError?.message || 'Connection failed',
    });

    return {
      success: false,
      error: lastError?.message || 'Connection failed after all retry attempts',
    };
  },

  async attemptConnection(serverUrl: string): Promise<ConnectionResult> {
    // Add client identification for audit tracking
    const urlWithClient = new URL(serverUrl);
    urlWithClient.searchParams.set('client', 'ui-client');
    
    const transport = new SSEClientTransport(urlWithClient);
    const client = new Client(
      { name: 'ui-client', version: '1.0.0' }, 
      { capabilities: { tools: {} } }
    );
    
    await client.connect(transport);
    
    // List available tools
    const toolsResponse = await client.listTools();
    const tools = toolsResponse.tools || [];
    
    return {
      success: true,
      client,
      tools,
    };
  },

  async isServerReachable(serverUrl: string): Promise<boolean> {
    try {
      const response = await fetch(serverUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  createConnectionHeartbeat(
    client: Client,
    interval: number = 30000,
    onConnectionLost?: () => void
  ): () => void {
    const heartbeatInterval = setInterval(async () => {
      try {
        await client.listTools();
      } catch (error) {
        console.warn('Heartbeat failed, connection may be lost:', error);
        clearInterval(heartbeatInterval);
        onConnectionLost?.();
      }
    }, interval);

    return () => clearInterval(heartbeatInterval);
  },

  getRetryDelay(attempt: number): number {
    // Exponential backoff with jitter: 1s, 2s, 4s, 8s, 16s, max 30s
    const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
    const jitter = Math.random() * 0.1 * baseDelay; // Add 10% jitter
    return Math.floor(baseDelay + jitter);
  },

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};