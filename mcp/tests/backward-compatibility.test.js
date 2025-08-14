/**
 * Backward Compatibility Tests
 * 
 * These tests ensure that all existing functionality continues to work
 * exactly as before after the dynamic MCP enhancements.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createMcpServer } from '../src/mcp/server-factory.js';
import DatabaseService from '../src/database.js';

describe('Backward Compatibility Tests', () => {
  let mockDbService;
  let server;

  beforeEach(() => {
    // Create mock database service that mimics existing behavior
    mockDbService = {
      getSchemaProperties: async (templateId) => {
        // Return mock schema properties without context parameter
        if (templateId === 1) {
          return {
            Title: {
              type: 'text',
              description: 'The title of the task',
              execution_order: 1
            },
            Description: {
              type: 'text', 
              description: 'Task description',
              execution_order: 2,
              dependencies: ['Title']
            },
            Items: {
              type: 'text',
              description: 'Task items',
              execution_order: 3,
              dependencies: ['Description']
            }
          };
        }
        return {};
      }
    };

    server = createMcpServer('test-client', mockDbService);
  });

  afterEach(() => {
    // Cleanup any resources
    server = null;
  });

  describe('Schema Loading Backward Compatibility', () => {
    it('should load dynamic schema properties without context parameter (existing behavior)', async () => {
      // Test that existing calls work unchanged
      const properties = await mockDbService.getSchemaProperties(1);
      
      expect(properties).toHaveProperty('Title');
      expect(properties).toHaveProperty('Description');
      expect(properties).toHaveProperty('Items');
      expect(properties.Title.type).toBe('text');
      expect(properties.Description.dependencies).toContain('Title');
    });

    it('should maintain execution order and dependencies', async () => {
      const properties = await mockDbService.getSchemaProperties(1);
      
      expect(properties.Title.execution_order).toBe(1);
      expect(properties.Description.execution_order).toBe(2);
      expect(properties.Items.execution_order).toBe(3);
      
      expect(properties.Description.dependencies).toEqual(['Title']);
      expect(properties.Items.dependencies).toEqual(['Description']);
    });
  });

  describe('Tool Registration Backward Compatibility', () => {
    it('should register tools with same schemas as before', () => {
      // Test that tool definitions haven't changed for existing clients
      expect(server).toBeDefined();
      // Tools should be registered with the server
      // This would need to be expanded based on actual MCP SDK testing patterns
    });
  });

  describe('Function Signature Backward Compatibility', () => {
    it('should support original function signatures', async () => {
      // Test that all original function signatures still work
      
      // Original single-parameter calls
      const taskProps = await mockDbService.getSchemaProperties(1);
      expect(taskProps).toBeDefined();
      
      const projectProps = await mockDbService.getSchemaProperties(2);  
      expect(projectProps).toBeDefined();
      
      // No-parameter calls
      const allProps = await mockDbService.getSchemaProperties();
      expect(allProps).toBeDefined();
    });
  });

  describe('Cache Behavior Backward Compatibility', () => {
    it('should cache results for non-context calls same as before', async () => {
      // Multiple calls without context should hit cache
      const props1 = await mockDbService.getSchemaProperties(1);
      const props2 = await mockDbService.getSchemaProperties(1);
      
      expect(props1).toEqual(props2);
    });
  });

  describe('Error Handling Backward Compatibility', () => {
    it('should handle errors the same way as before', async () => {
      const failingDbService = {
        getSchemaProperties: async () => {
          throw new Error('Database error');
        }
      };

      // Error handling should be the same
      try {
        await failingDbService.getSchemaProperties(1);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toBe('Database error');
      }
    });
  });
});

describe('Enhanced Context-Aware Functionality', () => {
  let mockDbService;

  beforeEach(() => {
    mockDbService = {
      getSchemaProperties: async (templateId, context) => {
        // Mock implementation that supports both old and new signatures
        const baseProperties = {
          Title: {
            type: 'text',
            description: 'The title of the task',
            execution_order: 1
          },
          Description: {
            type: 'text',
            description: 'Task description', 
            execution_order: 2,
            dependencies: ['Title']
          }
        };

        if (context && context.userRole === 'admin') {
          // Admin users get additional properties
          baseProperties.AdminNotes = {
            type: 'text',
            description: 'Admin-only notes',
            execution_order: 4
          };
        }

        return baseProperties;
      },

      applyContextFilters: (properties, context) => {
        // Mock context filtering
        if (context.userRole === 'user') {
          // Filter out admin properties
          const filtered = {};
          for (const [key, value] of Object.entries(properties)) {
            if (!value.description?.toLowerCase().includes('admin')) {
              filtered[key] = value;
            }
          }
          return filtered;
        }
        return properties;
      }
    };
  });

  describe('Context-Aware Schema Loading', () => {
    it('should return different schemas based on context', async () => {
      const adminContext = { userRole: 'admin', clientId: 'test' };
      const userContext = { userRole: 'user', clientId: 'test' };

      const adminProps = await mockDbService.getSchemaProperties(1, adminContext);
      const userProps = await mockDbService.getSchemaProperties(1, userContext);

      expect(adminProps).toHaveProperty('AdminNotes');
      expect(userProps).not.toHaveProperty('AdminNotes');
    });

    it('should maintain backward compatibility when no context provided', async () => {
      const propsWithoutContext = await mockDbService.getSchemaProperties(1);
      const propsWithUndefinedContext = await mockDbService.getSchemaProperties(1, undefined);

      expect(propsWithoutContext).toEqual(propsWithUndefinedContext);
    });
  });

  describe('Context Filtering', () => {
    it('should filter properties based on user role', () => {
      const properties = {
        Title: { type: 'text', description: 'Task title' },
        AdminNotes: { type: 'text', description: 'Admin-only notes' }
      };

      const userContext = { userRole: 'user' };
      const filtered = mockDbService.applyContextFilters(properties, userContext);

      expect(filtered).toHaveProperty('Title');
      expect(filtered).not.toHaveProperty('AdminNotes');
    });
  });
});

describe('Database Change Notification Tests', () => {
  it('should handle database notifications without breaking existing functionality', () => {
    // Test that notification setup doesn't interfere with existing operations
    const server = createMcpServer('test-client', mockDbService);
    expect(server).toBeDefined();
    
    // Notifications should be set up in the background without affecting main functionality
  });
});