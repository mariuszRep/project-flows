#!/usr/bin/env node

/**
 * Project Flows MCP Server - Main Entry Point
 * 
 * A TypeScript MCP server with SSE transport for real-time multi-client communication,
 * PostgreSQL integration for persistent task storage, and dynamic schema system.
 */

import DatabaseService from "./database.js";
import { createExpressApp } from "./server/express-server.js";
import { ConnectionManager } from "./server/connection-manager.js";
import { createMcpServer } from "./mcp/server-factory.js";

// Initialize shared database service for all connections
const sharedDbService = new DatabaseService();

// Create Express app and connection manager
const app = createExpressApp();
const connectionManager = new ConnectionManager();

// Root endpoint
app.get("/", async (_: any, res: any) => {
  res.status(200).send('Project Flows MCP Server - Multiple clients supported with shared database');
});

// SSE endpoint for MCP client connections
app.get("/sse", async (req: any, res: any) => {
  await connectionManager.handleSSEConnection(req, res, (clientId) => 
    createMcpServer(clientId, sharedDbService)
  );
});

// POST endpoint for MCP messages
app.post("/messages", async (req: any, res: any) => {
  await connectionManager.handlePostMessage(req, res);
});

async function main() {
  /**
   * Main entry point for the server.
   */
  // Initialize database connection
  try {
    await sharedDbService.initialize();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  // Cleanup database connection on exit
  process.on('SIGINT', async () => {
    console.log('Closing database connection...');
    await sharedDbService.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Closing database connection...');
    await sharedDbService.close();
    process.exit(0);
  });
  
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`🚀 Project Flows MCP Server running on port ${port}`);
    console.log('📊 Multiple clients can now connect simultaneously');
    console.log('🗄️ Shared database ensures all clients see the same data');
    console.log(`🔗 Connect to: http://localhost:${port}/sse`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}