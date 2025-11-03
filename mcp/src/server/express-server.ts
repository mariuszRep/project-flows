import express from "express";
import cors from "cors";

export function createExpressApp(): express.Application {
  const app = express();

  // Enable CORS with exposed headers for Streamable HTTP transport
  app.use(cors({
    origin: '*', // Allow all origins - adjust as needed for production
    exposedHeaders: ['Mcp-Session-Id'], // Expose session ID header to browser clients
  }));

  // Parse JSON request bodies for all routes
  app.use(express.json());

  // Add request timeout (but skip for MCP endpoint with SSE streams)
  app.use((req: any, res: any, next: any) => {
    // Skip timeout for MCP endpoint since SSE streams are long-lived
    if (req.url !== '/mcp' || req.method === 'POST') {
      res.setTimeout(30000, () => {
        console.log('Request timeout for', req.url);
        if (!res.headersSent) {
          res.status(408).send('Request timeout');
        }
      });
    }
    next();
  });

  return app;
}

export function extractClientFromUserAgent(userAgent: string): string | null {
  if (!userAgent) return null;
  
  // Common MCP client patterns
  if (userAgent.includes('windsurf')) return 'windsurf';
  if (userAgent.includes('claude-desktop')) return 'claude-desktop';
  if (userAgent.includes('cursor')) return 'cursor';
  if (userAgent.includes('vscode')) return 'vscode';
  if (userAgent.includes('cline')) return 'cline';
  
  return null;
}