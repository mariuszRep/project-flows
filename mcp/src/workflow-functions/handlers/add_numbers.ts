/**
 * Add Numbers Function Handler
 * Adds two numbers together and returns the result
 */

export interface FunctionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export default async function add_numbers(params: { a: any; b: any }, context?: any): Promise<FunctionResult> {
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
