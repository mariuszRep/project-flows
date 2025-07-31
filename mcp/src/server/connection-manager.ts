import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { extractClientFromUserAgent } from "./express-server.js";
import { stateEvents, StateChangeEvent } from "../events/state-events.js";

export interface Connection {
  transport: SSEServerTransport;
  server: Server;
  clientId: string;
}

export class ConnectionManager {
  private connections: { [sessionId: string]: Connection } = {};

  constructor() {
    // Listen for global state change events
    stateEvents.on('state_change', (event: StateChangeEvent) => {
      this.broadcastStateChange(event);
    });
  }

  async handleSSEConnection(req: any, res: any, createMcpServer: (clientId: string) => Server): Promise<void> {
    try {
      // Extract client ID from headers, query params, or user-agent as fallback
      const clientId = req.headers['x-mcp-client'] || 
                       req.headers['x-client-id'] || 
                       req.query.client || 
                       req.query.clientId || 
                       extractClientFromUserAgent(req.headers['user-agent']) || 
                       'unknown';
      
      const transport = new SSEServerTransport('/messages', res);
      const serverInstance = createMcpServer(clientId); // Create new MCP server instance per connection with client ID
      
      this.connections[transport.sessionId] = { transport, server: serverInstance, clientId };
      
      // Clean up connection on close
      res.on("close", () => {
        console.log(`Connection closed for session: ${transport.sessionId}`);
        delete this.connections[transport.sessionId];
      });
      
      console.log(`New connection established with session: ${transport.sessionId}, client: ${clientId}`);
      console.log(`Active connections: ${Object.keys(this.connections).length}`);
      
      // Each server connects to its own transport
      await serverInstance.connect(transport);
    } catch (error) {
      console.error('Error establishing SSE connection:', error);
      res.status(500).send('Failed to establish connection');
    }
  }

  async handlePostMessage(req: any, res: any): Promise<void> {
    const sessionId = req.query.sessionId as string;
    const connection = this.connections[sessionId];
    
    if (connection) {
      try {
        // Update client ID from headers if provided in POST request
        const headerClientId = req.headers['x-mcp-client'] || 
                              req.headers['x-client-id'] || 
                              extractClientFromUserAgent(req.headers['user-agent']);
        
        if (headerClientId && headerClientId !== connection.clientId) {
          connection.clientId = headerClientId;
          console.log(`Updated client ID for session ${sessionId}: ${headerClientId}`);
        }
        
        await connection.transport.handlePostMessage(req, res);
      } catch (error) {
        console.error(`Error handling message for session ${sessionId}:`, error);
        res.status(500).send('Error processing message');
      }
    } else {
      console.warn(`No connection found for sessionId: ${sessionId}`);
      console.log(`Available sessions: ${Object.keys(this.connections).join(', ')}`);
      res.status(400).send('No connection found for sessionId');
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
}