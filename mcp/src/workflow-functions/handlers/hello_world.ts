/**
 * Hello World Function Handler
 * Returns a greeting message
 */

export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export default async function hello_world(params: { name?: string }, context?: any): Promise<FunctionResult> {
  const name = params.name || "World";
  const message = `Hello, ${name}!`;

  return {
    success: true,
    data: {
      message,
      timestamp: new Date().toISOString()
    }
  };
}
