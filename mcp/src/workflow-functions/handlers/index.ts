/**
 * Function Handler Registry
 * Maps function handler names to their implementations
 *
 * To add a new function handler:
 * 1. Create a new file in this directory (e.g., my_function.ts)
 * 2. Export a default async function that takes params and returns FunctionResult
 * 3. Add an entry here mapping the handler name to the dynamic import
 */

export const handlers: Record<string, () => Promise<any>> = {
  add_numbers: () => import('./add_numbers.js').then(m => m.default),
  hello_world: () => import('./hello_world.js').then(m => m.default),
  get_object: () => import('./get_object.js').then(m => m.default),
};
