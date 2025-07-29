import express from "express";
import cors from "cors";

export function createExpressApp(): express.Application {
  const app = express();

  // Enable CORS for all routes
  app.use(cors());

  // Add request timeout and connection limits (but skip for SSE connections)
  app.use((req: any, res: any, next: any) => {
    // Skip timeout for SSE connections since they're meant to be long-lived
    if (req.url !== '/sse') {
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