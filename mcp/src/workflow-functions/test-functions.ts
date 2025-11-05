/**
 * TEST WORKFLOW FUNCTIONS - PROOF OF CONCEPT
 *
 * This file contains simple test functions for demonstrating workflow function calling.
 * These functions are intentionally isolated and can be safely removed.
 *
 * DO NOT USE IN PRODUCTION - FOR TESTING ONLY
 */

/**
 * Function result type
 */
export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Simple hello world function
 */
export async function hello_world(params: { name?: string }): Promise<FunctionResult> {
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

/**
 * Simple addition function
 */
export async function add_numbers(params: { a: number; b: number }): Promise<FunctionResult> {
  if (typeof params.a !== "number" || typeof params.b !== "number") {
    return {
      success: false,
      error: "Both 'a' and 'b' parameters are required and must be numbers"
    };
  }

  const sum = params.a + params.b;

  return {
    success: true,
    data: {
      a: params.a,
      b: params.b,
      sum,
      operation: `${params.a} + ${params.b} = ${sum}`
    }
  };
}
