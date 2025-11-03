import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

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
  async connect(
    serverUrl: string,
    onProgress?: (progress: ConnectionProgress) => void
  ): Promise<ConnectionResult> {
    try {
      onProgress?.({
        state: ConnectionState.CONNECTING,
        attempt: 1,
        maxAttempts: 1,
      });

      // Add client identification for audit tracking via query parameter
      const urlWithClient = new URL(serverUrl);
      urlWithClient.searchParams.set('client', 'ui-client');

      // Create StreamableHTTPClientTransport with built-in reconnection
      const transport = new StreamableHTTPClientTransport(urlWithClient, {
        reconnectionOptions: {
          maxReconnectionDelay: 30000,      // 30 seconds max
          initialReconnectionDelay: 1000,   // Start with 1 second
          reconnectionDelayGrowFactor: 1.5, // Exponential backoff
          maxRetries: 5,                     // Try 5 times
        },
      });

      // Create MCP client
      const client = new Client(
        { name: 'ui-client', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );

      // Connect to server (SDK handles retries automatically)
      await client.connect(transport);

      // List available tools
      const toolsResponse = await client.listTools();
      const tools = toolsResponse.tools || [];

      onProgress?.({
        state: ConnectionState.CONNECTED,
        attempt: 1,
        maxAttempts: 1,
      });

      return {
        success: true,
        client,
        tools,
      };
    } catch (error) {
      onProgress?.({
        state: ConnectionState.FAILED,
        attempt: 1,
        maxAttempts: 1,
        error: (error as Error).message,
      });

      return {
        success: false,
        error: (error as Error).message || 'Connection failed',
      };
    }
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
};