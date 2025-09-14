import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { Button } from '@/components/ui/button';
import { UnifiedEntityCard } from '@/components/ui/unified-entity-card';
import { Badge } from '@/components/ui/badge';
import { useMCP } from '@/contexts/MCPContext';
import { useProject } from '@/contexts/ProjectContext';
import { Task, TaskStage } from '@/types/task';
import { Project } from '@/types/project';
import { UnifiedEntity, mapToUnifiedEntity } from '@/types/unified-entity';
import { useChangeEvents } from '@/hooks/useChangeEvents';
import { MCPDisconnectedState } from '@/components/ui/empty-state';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { ProjectSidebar } from '@/components/ui/project-sidebar';
import { parseTaskDate } from '@/lib/utils';
import { FileText, Plus, ArrowRight, Filter } from 'lucide-react';
import UnifiedForm from '@/components/forms/UnifiedForm';
import ObjectView, { TEMPLATE_ID } from '@/components/forms/ObjectView';

const DraftTasks = () => {
  const navigate = useNavigate();
  const { callTool, isConnected, tools } = useMCP();
  const { 
    projects, 
    selectedProjectId, 
    setSelectedProjectId, 
    selectProject,
    fetchProjects,
    createProject,
    getSelectedProject 
  } = useProject();
  
  const [allEntities, setAllEntities] = useState<UnifiedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateProjectForm, setShowCreateProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  
  // Filter state - default to all stages selected
  const [selectedStages, setSelectedStages] = useState<TaskStage[]>(['draft', 'backlog', 'doing', 'review', 'completed']);
  
  // Entity viewing state
  const [viewingEntityId, setViewingEntityId] = useState<number | null>(null);
  const [viewingEntityType, setViewingEntityType] = useState<'Task' | 'Project' | 'Epic' | null>(null);
  
  // Edit entity state
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<number | null>(null);
  
  // Project view state
  const [viewingProjectId, setViewingProjectId] = useState<number | null>(null);
  
  // Delete task state
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    taskId: number | null;
    taskTitle: string;
  }>({
    isOpen: false,
    taskId: null,
    taskTitle: '',
  });
  
  const stages: { key: TaskStage; title: string; color: string }[] = [
    { key: 'draft', title: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
    { key: 'backlog', title: 'Backlog', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    { key: 'doing', title: 'Doing', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
    { key: 'review', title: 'Review', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
    { key: 'completed', title: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' }
  ];

  // Choose base entities: if a single project is selected, display its children instead of the project card
  const baseEntities: UnifiedEntity[] = (() => {
    if (selectedProjectId !== null) {
      const root = allEntities.find(e => e.id === selectedProjectId);
      return root?.children || [];
    }
    return allEntities;
  })();

  // Helper function to check if an entity or any of its children are visible
  const hasVisibleChildren = (entity: UnifiedEntity): boolean => {
    // If all stages are selected, everything is visible
    if (selectedStages.length === 0 || selectedStages.length === stages.length) {
      return true;
    }

    // A task is visible if its stage is selected
    if (entity.type === 'Task' && entity.stage) {
      return selectedStages.includes(entity.stage);
    }

    // An epic or project is visible if any of its children are visible
    if (entity.children && entity.children.length > 0) {
      return entity.children.some(hasVisibleChildren);
    }

    // Default to not visible if no conditions are met
    return false;
  };

  // Get filtered entities based on selected stages and sort chronologically
  const filteredEntities = baseEntities
    .filter(entity => {
      const allStagesSelected = selectedStages.length === stages.length;

      // When all stages are selected or no filter is applied, show all entities
      if (allStagesSelected || selectedStages.length === 0) {
        return true;
      }

      // For epics, show them if they have any visible children
      if (entity.type === 'Epic') {
        return hasVisibleChildren(entity);
      }
      
      // For tasks, filter by selected stages
      if (entity.type === 'Task' && entity.stage) {
        return selectedStages.includes(entity.stage);
      }
      
      // Always show projects at the root level, but their children will be filtered
      if (entity.type === 'Project') {
        return true;
      }
      
      return false; // Default to hiding entities that don't match
    })
    .sort((a, b) => {
      // Chronological sorting by updated_at timestamp (most recent first)
      const aHasValidTime = a.updated_at || a.created_at;
      const bHasValidTime = b.updated_at || b.created_at;
      
      if (aHasValidTime && bHasValidTime) {
        // Both have timestamps - sort by date
        const dateA = parseTaskDate(a.updated_at || a.created_at);
        const dateB = parseTaskDate(b.updated_at || b.created_at);
        
        // If dates are not epoch (meaning they were parsed successfully), use them
        if (dateA.getTime() !== 0 && dateB.getTime() !== 0) {
          return dateB.getTime() - dateA.getTime();
        }
      }
      
      // Fall back to ID-based sorting (higher ID = more recent)
      return b.id - a.id;
    });

  const taskCountsByStage = React.useMemo(() => {
    const counts: { [stage in TaskStage]: number } = {
      draft: 0,
      backlog: 0,
      doing: 0,
      review: 0,
      completed: 0,
    };
    const flattenEntities = (entities: UnifiedEntity[]): UnifiedEntity[] => {
        let flat: UnifiedEntity[] = [];
        for (const entity of entities) {
          flat.push(entity);
          if (entity.children) {
            flat = flat.concat(flattenEntities(entity.children));
          }
        }
        return flat;
    };
    const flatEntities = flattenEntities(allEntities);
    for (const entity of flatEntities) {
      if (entity.type === 'Task' && entity.stage) {
        if (counts[entity.stage] !== undefined) {
            counts[entity.stage]++;
        }
      }
    }
    return counts;
  }, [allEntities]);

  // Function to build hierarchical structure from flat entity list
  const buildHierarchy = (entities: UnifiedEntity[]): UnifiedEntity[] => {
    // Create a map for quick lookup
    const entityMap = new Map<number, UnifiedEntity>();
    const result: UnifiedEntity[] = [];
    
    // First pass: create a map of all entities with empty children arrays
    entities.forEach(entity => {
      entityMap.set(entity.id, { ...entity, children: [] });
    });
    
    // Second pass: build parent-child relationships
    entities.forEach(entity => {
      const currentEntity = entityMap.get(entity.id)!;
      
      if (entity.parent_id && entityMap.has(entity.parent_id)) {
        // This entity has a parent - add it to parent's children
        const parent = entityMap.get(entity.parent_id)!;
        parent.children!.push(currentEntity);
      } else {
        // This entity has no parent or parent not found - add to root level
        result.push(currentEntity);
      }
    });
    
    return result;
  };

  // Fetch all entities from MCP using list_objects
  const fetchAllEntities = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (isConnected && callTool && tools.length > 0) {
        const listObjectsTool = tools.find(tool => tool.name === 'list_objects');
        
        if (listObjectsTool) {
          let allEntities: UnifiedEntity[] = [];
          
          if (selectedProjectId !== null) {
            // When a project is selected, fetch ALL descendants (multi-level)
            console.log(`Fetching all descendants for project: ${selectedProjectId}`);

            // Get all objects, then filter to the selected project's subtree
            const allResult = await callTool('list_objects', {});
            const allContentText = allResult?.content?.[0]?.text || '';

            if (allContentText) {
              const allJson = JSON.parse(allContentText);
              const allArray = Array.isArray(allJson) ? allJson : allJson.objects;

              if (Array.isArray(allArray)) {
                const allMappedEntities = allArray.map(mapToUnifiedEntity);

                // Build adjacency map parent_id -> children ids
                const childrenByParent = new Map<number, number[]>();
                for (const e of allMappedEntities) {
                  if (e.parent_id) {
                    const list = childrenByParent.get(e.parent_id) || [];
                    list.push(e.id);
                    childrenByParent.set(e.parent_id, list);
                  }
                }

                // BFS to collect all descendant ids including root project
                const toVisit: number[] = [selectedProjectId];
                const includeIds = new Set<number>([selectedProjectId]);
                while (toVisit.length) {
                  const cur = toVisit.shift()!;
                  const kids = childrenByParent.get(cur) || [];
                  for (const kid of kids) {
                    if (!includeIds.has(kid)) {
                      includeIds.add(kid);
                      toVisit.push(kid);
                    }
                  }
                }

                // Filter to subtree and rebuild hierarchy so parents have children arrays
                const subtree = allMappedEntities.filter(e => includeIds.has(e.id));
                allEntities = buildHierarchy(subtree);
              }
            }
          } else {
            // No project selected - get all objects
            console.log('Calling list_objects for all objects');
            const result = await callTool('list_objects', {});
            const contentText = result?.content?.[0]?.text || '';
            
            if (contentText) {
              const json = JSON.parse(contentText);
              const arr = Array.isArray(json) ? json : json.objects;
              if (Array.isArray(arr)) {
                const mappedEntities = arr.map(mapToUnifiedEntity);
                allEntities = buildHierarchy(mappedEntities);
              }
            }
          }
          
          setAllEntities(allEntities || []);
          return;
        }
      }
    } catch (err) {
      console.error('Error fetching entities:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch entities');
    } finally {
      setIsLoading(false);
    }
  };

  // Set up change event listeners for real-time updates
  // Suppress immediate refetch after our own optimistic updates using a timeout-based approach
  const suppressRefreshTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const suppressRefreshForDuration = (durationMs: number = 1000) => {
    // Clear any existing timeout
    if (suppressRefreshTimeoutRef.current) {
      clearTimeout(suppressRefreshTimeoutRef.current);
    }
    
    // Set a new timeout to allow refreshes again after the duration
    suppressRefreshTimeoutRef.current = setTimeout(() => {
      suppressRefreshTimeoutRef.current = null;
    }, durationMs);
  };

  const shouldSuppressRefresh = () => {
    return suppressRefreshTimeoutRef.current !== null;
  };

  const { callToolWithEvent, emitTaskChanged, emitProjectChanged, emitDataChanged } = useChangeEvents({
    onTaskChanged: () => {
      if (shouldSuppressRefresh()) {
        console.log('Task changed event received but suppressed due to recent optimistic update');
        return;
      }
      console.log('Task changed event received, refreshing entities');
      fetchAllEntities();
    },
    onProjectChanged: () => {
      if (shouldSuppressRefresh()) {
        console.log('Project changed event received but suppressed due to recent optimistic update');
        return;
      }
      console.log('Project changed event received, refreshing entities');
      fetchAllEntities();
    }
  });

  // Initial fetch when component mounts or dependencies change
  useEffect(() => {
    fetchAllEntities();
  }, [isConnected, tools, selectedProjectId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (suppressRefreshTimeoutRef.current) {
        clearTimeout(suppressRefreshTimeoutRef.current);
      }
    };
  }, []);

  const handleStageToggle = (stage: TaskStage, ctrlKey: boolean = false) => {
    setSelectedStages(prev => {
      if (ctrlKey) {
        // Multi-select mode with Ctrl key
        if (prev.includes(stage)) {
          // Remove stage if already selected (but keep at least one selected)
          return prev.length > 1 ? prev.filter(s => s !== stage) : prev;
        } else {
          // Add stage if not selected
          return [...prev, stage];
        }
      } else {
        // Single select mode - replace selection with clicked stage
        return [stage];
      }
    });
  };


  const handleClearAll = () => {
    setSelectedStages(['draft', 'backlog', 'doing', 'review', 'completed']); // Reset to all stages
  };

  const handleEditTask = (taskId: number) => {
    setEditingTaskId(taskId);
  };
  
  const findEntityById = (entities: UnifiedEntity[], id: number): UnifiedEntity | undefined => {
    for (const e of entities) {
      if (e.id === id) return e;
      if (e.children && e.children.length) {
        const found = findEntityById(e.children, id);
        if (found) return found;
      }
    }
    return undefined;
  };

  const handleEntityView = (entityId: number) => {
    // Search recursively across the full hierarchy
    const entity = findEntityById(allEntities, entityId);
    if (entity) {
      console.log(`TaskList DEBUG: Found entity for ID ${entityId}:`, entity);
      console.log(`TaskList DEBUG: Setting viewingEntityType to ${entity.type} and viewingEntityId to ${entityId}`);
      
      setViewingEntityId(entityId);
      setViewingEntityType(entity.type);
      
      // For backward compatibility, set specific view states
      if (entity.type === 'Task') {
        console.log(`TaskList DEBUG: Setting viewingTaskId to ${entityId}`);
        setViewingTaskId(entityId);
      } else if (entity.type === 'Project' || entity.type === 'Epic') {
        console.log(`TaskList DEBUG: Setting viewingProjectId to ${entityId}, entity type is ${entity.type}`);
        setViewingProjectId(entityId);
      }
    } else {
      console.error('TaskList ERROR: Entity not found for ID:', entityId);
      console.log('TaskList DEBUG: Available entities:', allEntities.map(e => ({id: e.id, type: e.type, template_id: e.template_id})));
    }
  };
  
  const handleSwitchToEdit = () => {
    if (viewingTaskId) {
      setEditingTaskId(viewingTaskId);
      setViewingTaskId(null);
    }
  };
  
  const handleEditSuccess = async (entity: Task | Project) => {
    console.log('Entity updated successfully:', entity);
    setEditingTaskId(null);
    setError(null);
    // Refresh entities after successful update
    await fetchAllEntities();
  };
  
  const handleEditCancel = () => {
    setEditingTaskId(null);
    setError(null);
  };

  const handleTaskDelete = (taskId: number, taskTitle: string) => {
    setDeleteDialog({
      isOpen: true,
      taskId,
      taskTitle,
    });
  };

  // Helper: remove an entity from a nested tree immutably
  const removeEntityFromTree = (nodes: UnifiedEntity[], targetId: number): UnifiedEntity[] => {
    return nodes.reduce<UnifiedEntity[]>((acc, node) => {
      if (node.id === targetId) {
        // Drop this node
        return acc;
      }
      const newChildren = node.children && node.children.length
        ? removeEntityFromTree(node.children, targetId)
        : [];
      acc.push({ ...node, children: newChildren });
      return acc;
    }, []);
  };

  const confirmTaskDelete = async () => {
    if (!isConnected || !callToolWithEvent || !deleteDialog.taskId) {
      console.log('MCP not connected or no task ID, skipping delete');
      setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
      return;
    }

    try {
      // Find the entity to get its template_id
      const entity = findEntityById(allEntities, deleteDialog.taskId);
      if (!entity) {
        console.error('Entity not found:', deleteDialog.taskId);
        return;
      }

      // Resolve delete_object tool name (supports namespaced variants, e.g., mcp0_delete_object)
      const deleteTool = tools.find(tool => tool.name === 'delete_object') 
        || tools.find(tool => tool.name.endsWith('delete_object') || tool.name.includes('delete_object'));
      
      if (deleteTool) {
        // Use callToolWithEvent to trigger events after successful deletion
        const result = await callToolWithEvent(deleteTool.name, {
          object_id: deleteDialog.taskId,
          template_id: entity.template_id
        });
        
        console.log('Delete result:', result);
        
        // Remove entity from local state immediately for better UX (deep removal)
        setAllEntities(prevEntities => removeEntityFromTree(prevEntities, deleteDialog.taskId!));
        
        // Close edit form if the deleted task was being edited
        if (editingTaskId === deleteDialog.taskId) {
          setEditingTaskId(null);
        }

        // Close any open viewers for this entity
        if (viewingTaskId === deleteDialog.taskId) {
          setViewingTaskId(null);
        }
        if (viewingEntityId === deleteDialog.taskId) {
          setViewingEntityId(null);
          setViewingEntityType(null);
        }
        
        // No need to manually refresh - the event system will handle it
      } else {
        console.log('Delete tool not available');
        setError('Delete functionality is not available');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      // Refresh entities in case of error to restore correct state
      await fetchAllEntities();
    } finally {
      setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
    }
  };

  const cancelTaskDelete = () => {
    setDeleteDialog({ isOpen: false, taskId: null, taskTitle: '' });
  };

  const handleMoveEntity = async (entityId: number, newStage: TaskStage) => {
    try {
      // Find the entity (search recursively across hierarchy) to get its template_id
      const entity = findEntityById(allEntities, entityId);
      if (!entity) {
        console.error('Entity not found:', entityId);
        return;
      }

      // 1) Optimistically update local state to avoid flicker
      const updateStageInTree = (nodes: UnifiedEntity[]): UnifiedEntity[] =>
        nodes.map(n => {
          if (n.id === entityId) {
            return { ...n, stage: newStage };
          }
          if (n.children && n.children.length) {
            return { ...n, children: updateStageInTree(n.children) };
          }
          return n;
        });

      setAllEntities(prev => updateStageInTree(prev));

      // 2) Persist change via MCP using entity-specific tools for proper stage handling
      if (isConnected && callToolWithEvent) {
        // Suppress refreshes for a short duration to prevent full page refreshes from events
        suppressRefreshForDuration(1000); // Suppress for 1 second

        // Determine correct tool based on entity template_id
        let toolName: string;
        let toolArgs: Record<string, any>;
        
        if (entity.template_id === 1) {
          // Task
          toolName = 'update_task';
          toolArgs = { task_id: entityId, stage: newStage };
        } else if (entity.template_id === 2) {
          // Project
          toolName = 'update_project';
          toolArgs = { project_id: entityId, stage: newStage };
        } else if (entity.template_id === 3) {
          // Epic
          toolName = 'update_epic';
          toolArgs = { epic_id: entityId, stage: newStage };
        } else {
          console.error(`Unknown template_id ${entity.template_id} for entity ${entityId}`);
          return; // Exit early if we don't know how to handle this entity type
        }

        // Find the appropriate tool
        const updateTool = tools.find(tool => tool.name === toolName);
        if (updateTool) {
          await callToolWithEvent(toolName, toolArgs);
        } else {
          console.error(`Tool ${toolName} not found for entity type ${entity.template_id}`);
          setError(`Unable to update entity: ${toolName} tool not available`);
          return;
        }
      }
    } catch (err) {
      console.error('Error moving entity:', err);
      setError(err instanceof Error ? err.message : 'Failed to move entity');
      // If optimistic update went through but server failed, refresh to reconcile
      await fetchAllEntities();
    }
  };

  const getNextStage = (currentStage: TaskStage): TaskStage => {
    const stageOrder: TaskStage[] = ['draft', 'backlog', 'doing', 'review', 'completed'];
    const currentIndex = stageOrder.indexOf(currentStage);
    return currentIndex < stageOrder.length - 1 ? stageOrder[currentIndex + 1] : currentStage;
  };

  const getPreviousStage = (currentStage: TaskStage): TaskStage => {
    const stageOrder: TaskStage[] = ['draft', 'backlog', 'doing', 'review', 'completed'];
    const currentIndex = stageOrder.indexOf(currentStage);
    return currentIndex > 0 ? stageOrder[currentIndex - 1] : currentStage;
  };

  const getStageColor = (stage: TaskStage) => {
    return stages.find(s => s.key === stage)?.color || 'bg-gray-100 text-gray-800';
  };

  const EmptyEntitiesState = () => (
    <div className="text-center py-12">
      <FileText className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No Items Found
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        {selectedStages.length === 1 
          ? `No tasks or projects match ${stages.find(s => s.key === selectedStages[0])?.title.toLowerCase()} stage.`
          : `No tasks or projects match the selected filters.`
        }
      </p>
      <div className="flex gap-3 justify-center">
        <Button onClick={() => navigate('/task-board')}>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
        <Button variant="outline" onClick={() => navigate('/task-board')}>
          View Board
        </Button>
      </div>
    </div>
  );

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleCreateProject = () => {
    setShowCreateProjectForm(true);
  };

  const handleProjectSuccess = async (project: Project) => {
    console.log('Project created/updated successfully:', project);
    setShowCreateProjectForm(false);
    setEditingProjectId(null);
    setError(null);
    await fetchProjects();
    // Trigger sidebar refresh
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  const handleProjectCancel = () => {
    setShowCreateProjectForm(false);
    setEditingProjectId(null);
    setError(null);
  };

  const handleEditProject = (project: Project) => {
    // First show the project view instead of directly editing
    setViewingProjectId(project.id);
    setViewingEntityType('Project');
  };
  
  const handleSwitchToProjectEdit = () => {
    if (viewingProjectId) {
      setEditingProjectId(viewingProjectId);
      setViewingProjectId(null);
    }
  };

  const handleProjectDelete = async (projectId: number, projectTitle: string) => {
    if (!isConnected || !callToolWithEvent) {
      console.log('MCP not connected, skipping project delete');
      return;
    }

    try {
      const deleteTool = tools.find(tool => tool.name === 'delete_object') 
        || tools.find(tool => tool.name.endsWith('delete_object') || tool.name.includes('delete_object'));
      
      if (deleteTool) {
        // Use callToolWithEvent to trigger events after successful deletion
        const result = await callToolWithEvent(deleteTool.name, {
          object_id: projectId,
          template_id: 2 // Projects have template_id = 2
        });
        
        console.log('Project delete result:', result);
        
        // Close the edit form
        setEditingProjectId(null);
        setShowCreateProjectForm(false);
        
        // If the deleted project was selected, deselect it
        if (selectedProjectId === projectId) {
          await handleProjectSelect(null);
        }
        
        // Trigger sidebar refresh and optimistically remove from local state
        setSidebarRefreshTrigger(prev => prev + 1);
        setAllEntities(prev => removeEntityFromTree(prev, projectId));
        
        // No need to manually refresh - the event system will handle it
      } else {
        console.log('Delete tool not available');
        setError('Delete functionality is not available');
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    }
  };

  const handleTaskSuccess = async (task: Task) => {
    console.log('Task created successfully:', task);
    setShowAddTaskForm(false);
    setError(null);
    // Refresh entities
    await fetchAllEntities();
  };

  const handleTaskCancel = () => {
    setShowAddTaskForm(false);
    setError(null);
  };

  const handleProjectSelect = async (projectId: number | null) => {
    try {
      // Use the MCP selectProject method to sync globally
      await selectProject(projectId);
    } catch (err) {
      console.error('Error selecting project:', err);
      // Fallback to local state if MCP fails
      setSelectedProjectId(projectId);
    }
  };

  const selectedProject = getSelectedProject();

  return (
    <HeaderAndSidebarLayout 
      onSettingsClick={handleSettingsClick} 
      fullWidth={true}
      sidebarContent={
        <ProjectSidebar
          selectedProjectId={selectedProjectId}
          onProjectSelect={handleProjectSelect}
          onCreateProject={handleCreateProject}
          onEditProject={handleEditProject}
          refreshTrigger={sidebarRefreshTrigger}
          isCollapsed={false} // This will be injected by the layout
        />
      }
    >
      <div className="w-full px-[10%] space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {selectedProject ? `${selectedProject.name} - Project Manager` : 'Project Manager'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {selectedProject 
                ? `Manage tasks, projects, and epics for ${selectedProject.name}` 
                : 'Manage your tasks, projects, and epics with chronological sorting'
              }
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/task-board')}>
              <ArrowRight className="h-4 w-4 mr-2" />
              View Board
            </Button>
            <Button onClick={() => setShowAddTaskForm(true)} disabled={!isConnected}>
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="w-full bg-surface border border-border rounded-[var(--radius-m)] py-2 px-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Filter by Stage</span>
              </div>
              <div className="flex items-center gap-2">
                {stages.map((stage) => {
                  const isSelected = selectedStages.includes(stage.key);
                  const getBorderColor = () => {
                    if (stage.key === 'draft') return 'border-gray-400 dark:border-gray-500';
                    if (stage.key === 'backlog') return 'border-blue-400 dark:border-blue-400';
                    if (stage.key === 'doing') return 'border-yellow-400 dark:border-yellow-400';
                    if (stage.key === 'review') return 'border-purple-400 dark:border-purple-400';
                    if (stage.key === 'completed') return 'border-green-400 dark:border-green-400';
                    return 'border-gray-400';
                  };
                  
                  return (
                    <button
                      key={stage.key}
                      onClick={(e) => handleStageToggle(stage.key, e.ctrlKey || e.metaKey)}
                      className="transition-all duration-200 cursor-pointer"
                    >
                      <Badge 
                        variant="secondary" 
                        className={`${stage.color} transition-all duration-200 ${
                          isSelected 
                            ? `border-2 ${getBorderColor()} shadow-sm` 
                            : 'border border-transparent hover:border-muted-foreground/30'
                        }`}
                      >
                        {stage.title}
                        <span className="ml-1 text-xs">
                          ({taskCountsByStage[stage.key]})
                        </span>
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading items...</p>
            </div>
          </div>
        ) : !isConnected ? (
          <MCPDisconnectedState />
        ) : filteredEntities.length === 0 ? (
          <EmptyEntitiesState />
        ) : (
          <div className="w-full">
            <div className="flex items-center justify-between mb-4 w-full">
              <h2 className="text-lg font-semibold">
                {filteredEntities.length} item{filteredEntities.length !== 1 ? 's' : ''} found
                <span className="text-muted-foreground text-sm ml-2">
                  ({filteredEntities.filter(e => e.type === 'Task').length} tasks, {filteredEntities.filter(e => e.type === 'Project').length} projects, {filteredEntities.filter(e => e.type === 'Epic').length} epics)
                </span>
              </h2>
            </div>
            <div className="space-y-3 w-full">
              {filteredEntities.map((entity) => (
                <UnifiedEntityCard
                  key={`${entity.type}-${entity.id}`}
                  entity={entity}
                  onStageChange={handleMoveEntity}
                  onDoubleClick={handleEntityView}
                  getStageColor={getStageColor}
                  stages={stages}
                  getPreviousStage={getPreviousStage}
                  getNextStage={getNextStage}
                  // Enable sliding when the entity has a stage
                  enableSliding={!!entity.stage}
                  selectedStages={selectedStages}
                  onTaskDoubleClick={handleEntityView}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Edit Task Form */}
        <UnifiedForm
          entityType="task"
          mode="edit"
          entityId={editingTaskId || undefined}
          templateId={1}
          onSuccess={handleEditSuccess}
          onCancel={handleEditCancel}
          onDelete={handleTaskDelete}
          isOpen={!!editingTaskId}
        />
        
        <ConfirmationDialog
          isOpen={deleteDialog.isOpen}
          onClose={cancelTaskDelete}
          onConfirm={confirmTaskDelete}
          title="Delete Task"
          description={`Are you sure you want to delete "${deleteDialog.taskTitle}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />

        <UnifiedForm
          entityType={(() => {
            // For editing, determine entity type from the actual entity data
            if (editingProjectId) {
              const entity = allEntities.find(e => e.id === editingProjectId);
              if (entity?.type === 'Epic') return 'epic';
              if (entity?.type === 'Project') return 'project';
            }
            // Default for create mode
            return 'project';
          })()}
          mode={editingProjectId ? 'edit' : 'create'}
          entityId={editingProjectId || undefined}
          templateId={(() => {
            // For editing, get template_id from the actual entity data  
            if (editingProjectId) {
              const entity = allEntities.find(e => e.id === editingProjectId);
              return entity?.template_id;
            }
            // Default for create mode (Project = template_id 2)
            return 2;
          })()}
          onSuccess={handleProjectSuccess}
          onCancel={handleProjectCancel}
          onDelete={handleProjectDelete}
          isOpen={showCreateProjectForm || !!editingProjectId}
        />

        <UnifiedForm
          entityType="task"
          mode="create"
          templateId={1}
          initialStage="draft"
          onSuccess={handleTaskSuccess}
          onCancel={handleTaskCancel}
          isOpen={showAddTaskForm}
        />
        
        <ObjectView
          entityType="task"
          entityId={viewingTaskId || 0}
          isOpen={!!viewingTaskId}
          onClose={() => setViewingTaskId(null)}
          onTaskUpdate={handleMoveEntity}
          onDelete={handleTaskDelete}
        />
        
        {viewingProjectId && viewingEntityType && (
          viewingEntityType === 'Epic' ? (
            <ObjectView
              entityType="epic"
              entityId={viewingProjectId}
              isOpen={!!viewingProjectId}
              onClose={() => {
                setViewingProjectId(null);
                setViewingEntityType(null);
              }}
              onDelete={handleProjectDelete}
              templateId={TEMPLATE_ID.EPIC}
            />
          ) : (
            <ObjectView
              entityType="project"
              entityId={viewingProjectId}
              isOpen={!!viewingProjectId}
              onClose={() => {
                setViewingProjectId(null);
                setViewingEntityType(null);
              }}
              onDelete={handleProjectDelete}
              templateId={TEMPLATE_ID.PROJECT}
            />
          )
        )}
      </div>
    </HeaderAndSidebarLayout>
  );
};

export default DraftTasks;
