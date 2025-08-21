import pg from 'pg';

interface NotificationConnection {
  id: string;
  res: any;
  clientId: string;
  lastPing: number;
}

export class NotificationHandler {
  private connections: Map<string, NotificationConnection> = new Map();
  private notificationClient: pg.Client | null = null;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupDatabaseNotifications();
    this.setupHeartbeat();
  }

  private async setupDatabaseNotifications(): Promise<void> {
    try {
      const { Client } = pg;
      this.notificationClient = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://mcp_user:mcp_password@localhost:5432/mcp_tasks',
      });

      await this.notificationClient.connect();
      console.log('Notification handler connected to PostgreSQL');

      // Listen for data changes directly
      await this.notificationClient.query('LISTEN data_changed');

      this.notificationClient.on('notification', (msg) => {
        try {
          if (msg.channel === 'data_changed' && msg.payload) {
            const dataChange = JSON.parse(msg.payload);
            console.log('Notification handler received data change:', dataChange);
            
            // Broadcast directly to notification clients
            this.broadcast({
              type: 'state_change',
              key: 'data_changed',
              value: dataChange,
              timestamp: dataChange.timestamp || new Date().toISOString(),
              source_client: dataChange.created_by || dataChange.updated_by || 'system'
            });
          }
        } catch (error) {
          console.error('Error processing database notification:', error);
        }
      });

      this.notificationClient.on('error', (error) => {
        console.error('PostgreSQL notification client error:', error);
        setTimeout(() => {
          this.setupDatabaseNotifications().catch(console.error);
        }, 5000);
      });

    } catch (error) {
      console.error('Failed to setup notification database connection:', error);
    }
  }

  private setupHeartbeat(): void {
    // Send ping every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [connId, connection] of this.connections.entries()) {
        try {
          // Send ping
          connection.res.write(`event: ping\ndata: ${now}\n\n`);
          connection.lastPing = now;
        } catch (error) {
          console.log(`Removing dead connection ${connId}`);
          this.connections.delete(connId);
        }
      }
    }, 30000);
  }

  async handleConnection(req: any, res: any): Promise<void> {
    const connectionId = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientId = req.headers['x-client-id'] || 
                    req.query.client || 
                    'ui-notification-client';

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Store connection
    this.connections.set(connectionId, {
      id: connectionId,
      res,
      clientId,
      lastPing: Date.now()
    });

    console.log(`New notification connection: ${connectionId} (client: ${clientId})`);
    console.log(`Active notification connections: ${this.connections.size}`);

    // Send welcome message
    res.write(`event: connected\ndata: {"connectionId": "${connectionId}"}\n\n`);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`Notification connection closed: ${connectionId}`);
      this.connections.delete(connectionId);
      console.log(`Active notification connections: ${this.connections.size}`);
    });

    req.on('error', (error: any) => {
      console.error(`Notification connection error for ${connectionId}:`, error);
      this.connections.delete(connectionId);
    });
  }

  private broadcast(event: any): void {
    const message = `event: state_change\ndata: ${JSON.stringify(event)}\n\n`;
    
    console.log(`Broadcasting to ${this.connections.size} notification clients:`, event);

    for (const [connId, connection] of this.connections.entries()) {
      try {
        connection.res.write(message);
      } catch (error) {
        console.error(`Failed to send notification to ${connId}:`, error);
        this.connections.delete(connId);
      }
    }
  }

  cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.notificationClient) {
      this.notificationClient.end().catch(console.error);
      this.notificationClient = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.res.end();
      } catch (error) {
        // Ignore errors when closing
      }
    }
    this.connections.clear();
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}

export function createNotificationHandler(): NotificationHandler {
  return new NotificationHandler();
}
