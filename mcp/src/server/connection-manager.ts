import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { InMemoryEventStore } from "@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js";
import { randomUUID } from "node:crypto";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { extractClientFromUserAgent } from "./express-server.js";
import { stateEvents, StateChangeEvent } from "../events/state-events.js";

export interface Connection {
  transport: StreamableHTTPServerTransport;
  server: Server;
  clientId: string;
  connectedAt: Date;
}

export interface SessionInfo {
  sessionId: string;
  clientId: string;
  connectedAt: string;
  duration: number; // in seconds
}

export class ConnectionManager {
  private connections: { [sessionId: string]: Connection } = {};

  constructor() {
    // Listen for global state change events
    stateEvents.on('state_change', (event: StateChangeEvent) => {
      this.broadcastStateChange(event);
    });
  }

  async handleStreamableHTTPRequest(
    req: any,
    res: any,
    createMcpServer: (clientId: string) => Server
  ): Promise<void> {
    try {
      // Check for existing session ID in headers
      const sessionId = req.headers['mcp-session-id'] as string;
      let transport: StreamableHTTPServerTransport;

      if (sessionId && this.connections[sessionId]) {
        // Reuse existing transport for this session
        transport = this.connections[sessionId].transport;
      } else if (!sessionId && req.method === 'POST' && isInitializeRequest(req.body)) {
        // New session initialization
        // Extract client ID from headers, query params, or user-agent
        const clientId = req.headers['x-mcp-client'] ||
                        req.headers['x-client-id'] ||
                        req.query.client ||
                        req.query.clientId ||
                        extractClientFromUserAgent(req.headers['user-agent']) ||
                        'unknown';

        // Create event store for resumability
        const eventStore = new InMemoryEventStore();

        // Create new transport with session management
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          eventStore,
          onsessioninitialized: (newSessionId: string) => {
            console.log(`Streamable HTTP session initialized: ${newSessionId}, client: ${clientId}`);
            // Store the connection
            this.connections[newSessionId] = {
              transport,
              server: serverInstance,
              clientId,
              connectedAt: new Date()
            };
            console.log(`Active connections: ${Object.keys(this.connections).length}`);
          },
          onsessionclosed: (closedSessionId: string) => {
            console.log(`Session closed: ${closedSessionId}`);
            delete this.connections[closedSessionId];
            console.log(`Active connections: ${Object.keys(this.connections).length}`);
          }
        });

        // Set up transport close handler
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && this.connections[sid]) {
            console.log(`Transport closed for session ${sid}`);
            delete this.connections[sid];
          }
        };

        // Create new MCP server instance for this connection
        const serverInstance = createMcpServer(clientId);

        // Connect the server to the transport
        await serverInstance.connect(transport);
      } else {
        // Invalid request - no session ID or not an initialization request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided or invalid initialization request',
          },
          id: null,
        });
        return;
      }

      // Handle the request with the transport
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling Streamable HTTP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  }

  getActiveConnectionCount(): number {
    return Object.keys(this.connections).length;
  }

  broadcastStateChange(event: StateChangeEvent): void {
    console.log(`Broadcasting state change to ${Object.keys(this.connections).length} connections:`, event);

    // Send to all connected clients except the source
    Object.entries(this.connections).forEach(([sessionId, connection]) => {
      if (connection.clientId !== event.source_client) {
        try {
          // Send MCP notification to client
          connection.server.notification({
            method: 'state_change',
            params: event
          });
        } catch (error) {
          console.error(`Failed to send state change to session ${sessionId}:`, error);
        }
      }
    });
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up all connections...');
    for (const sessionId in this.connections) {
      try {
        console.log(`Closing transport for session ${sessionId}`);
        await this.connections[sessionId].transport.close();
        delete this.connections[sessionId];
      } catch (error) {
        console.error(`Error closing transport for session ${sessionId}:`, error);
      }
    }
  }

  getActiveSessions(): SessionInfo[] {
    const now = new Date();
    return Object.entries(this.connections).map(([sessionId, connection]) => {
      const durationMs = now.getTime() - connection.connectedAt.getTime();
      return {
        sessionId,
        clientId: connection.clientId,
        connectedAt: connection.connectedAt.toISOString(),
        duration: Math.floor(durationMs / 1000) // Convert to seconds
      };
    });
  }

  async disconnectSession(sessionId: string): Promise<boolean> {
    const connection = this.connections[sessionId];
    if (!connection) {
      return false;
    }

    try {
      console.log(`Manually disconnecting session: ${sessionId} (client: ${connection.clientId})`);
      await connection.transport.close();
      delete this.connections[sessionId];
      console.log(`Session ${sessionId} disconnected. Active connections: ${Object.keys(this.connections).length}`);
      return true;
    } catch (error) {
      console.error(`Error disconnecting session ${sessionId}:`, error);
      return false;
    }
  }
}