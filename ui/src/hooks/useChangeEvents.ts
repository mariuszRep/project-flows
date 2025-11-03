import { useEffect, useCallback } from 'react';
import { changeEventService } from '@/services/changeEventService';
import { useMCP } from '@/contexts/MCPContext';

export interface UseChangeEventsOptions {
  onTaskChanged?: () => void;
  onProjectChanged?: () => void;
  onDataChanged?: () => void;
}

/**
 * Hook for listening to and emitting change events
 */
export const useChangeEvents = (options: UseChangeEventsOptions = {}) => {
  const { callTool } = useMCP();
  const { onTaskChanged, onProjectChanged, onDataChanged } = options;

  // Set up event listeners
  useEffect(() => {
    const cleanupFunctions: (() => void)[] = [];

    if (onTaskChanged) {
      const cleanup = changeEventService.on('task_changed', onTaskChanged);
      cleanupFunctions.push(cleanup);
    }

    if (onProjectChanged) {
      const cleanup = changeEventService.on('project_changed', onProjectChanged);
      cleanupFunctions.push(cleanup);
    }

    if (onDataChanged) {
      const cleanup = changeEventService.on('data_changed', onDataChanged);
      cleanupFunctions.push(cleanup);
    }

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [onTaskChanged, onProjectChanged, onDataChanged]);

  // Wrapper for MCP tool calls that automatically emit events
  const callToolWithEvent = useCallback(async (toolName: string, args?: any) => {
    if (!callTool) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await callTool(toolName, args);

      // Special handling for create_object
      if (toolName === 'create_object') {
        console.log('Object created via create_object, emitting events');

        // Always emit task_changed for all object types (universal refresh)
        changeEventService.emit('task_changed');
        changeEventService.emit('data_changed');

        // Additionally emit project_changed if it's a project (sidebar refresh)
        if (args?.template_id === 2) {
          console.log('Project created, also emitting project_changed event');
          changeEventService.emit('project_changed');
        }
      }
      // Emit appropriate events based on the tool called
      else if (toolName.includes('task')) {
        console.log('Task operation completed, emitting task_changed event');
        changeEventService.emit('task_changed');
        changeEventService.emit('data_changed');
      } else if (toolName.includes('project')) {
        console.log('Project operation completed, emitting project_changed event');
        changeEventService.emit('project_changed');
        changeEventService.emit('data_changed');
      }

      return result;
    } catch (error) {
      console.error(`Exception in MCP tool call ${toolName}:`, error);
      throw error; // Re-throw to allow caller to handle the error
    }
  }, [callTool]);

  // Direct event emitters
  const emitTaskChanged = useCallback(() => {
    changeEventService.emit('task_changed');
    changeEventService.emit('data_changed');
  }, []);

  const emitProjectChanged = useCallback(() => {
    changeEventService.emit('project_changed');
    changeEventService.emit('data_changed');
  }, []);

  const emitDataChanged = useCallback(() => {
    changeEventService.emit('data_changed');
  }, []);

  return {
    callToolWithEvent,
    emitTaskChanged,
    emitProjectChanged,
    emitDataChanged
  };
};