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
export async function add_numbers(params: { a: any; b: any }): Promise<FunctionResult> {
  console.log('add_numbers called with params:', JSON.stringify(params));
  
  // Handle both direct values and { type, value } objects
  const getValue = (param: any): number => {
    console.log('getValue called with param:', JSON.stringify(param));
    
    if (param === undefined || param === null) {
      console.log('Parameter is undefined or null');
      return NaN;
    }
    
    // Handle { type, value } object
    if (param && typeof param === 'object' && 'value' in param) {
      const value = param.value;
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      console.log(`Extracted value from object: ${value} -> ${num}`);
      return num;
    }
    
    // Handle direct number or string
    const num = typeof param === 'string' ? parseFloat(param) : Number(param);
    console.log(`Converted direct value: ${param} -> ${num}`);
    return num;
  };

  const a = getValue(params.a);
  const b = getValue(params.b);

  if (isNaN(a) || isNaN(b)) {
    return {
      success: false,
      error: "Both 'a' and 'b' parameters are required and must be valid numbers"
    };
  }

  const sum = a + b;

  return {
    success: true,
    data: {
      a,
      b,
      sum,
      operation: `${a} + ${b} = ${sum}`
    }
  };
}
