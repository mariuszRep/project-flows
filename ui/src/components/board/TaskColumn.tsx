import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { UnifiedEntityCard } from '@/components/ui/unified-entity-card';
import { Task, TaskStage } from '@/types/task';
import { Project } from '@/types/project';
import { UnifiedEntity } from '@/types/unified-entity';

// Utility function to convert Task to UnifiedEntity
const taskToUnifiedEntity = (task: Task): UnifiedEntity => {
  return {
    id: task.id,
    title: task.title || task.blocks?.Title || task.Title || 'Untitled Task',
    summary: task.body || task.blocks?.Summary || task.blocks?.Description || task.Summary || task.Description || '',
    stage: task.stage,
    type: 'Task',
    template_id: task.template_id || 1,
    parent_id: task.parent_id || task.project_id,
    created_at: task.created_at,
    updated_at: task.updated_at,
    created_by: task.created_by,
    updated_by: task.updated_by,
  };
};

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  onTaskUpdate: (taskId?: number, newStage?: string) => void;
  onTaskDelete: (taskId: number, taskTitle: string) => void;
  onTaskEdit: (taskId: number) => void;
  isDraggingOver?: boolean;
  projects: Project[];
}

export const TaskColumn: React.FC<TaskColumnProps> = ({
  title,
  tasks,
  onTaskUpdate,
  onTaskDelete,
  onTaskEdit,
  isDraggingOver = false,
  projects
}) => {
  return (
    <div className="flex-1 space-y-3 overflow-y-auto">
      {tasks.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <p className="text-sm">
            {isDraggingOver ? 'Drop task here' : `No tasks in ${title.toLowerCase()}`}
          </p>
        </div>
      ) : (
        tasks.map((task, index) => (
          <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
            {(provided, snapshot) => (
              <UnifiedEntityCard
                entity={taskToUnifiedEntity(task)}
                onTaskDoubleClick={() => onTaskEdit(task.id)}
                enableDragging={true}
                dragConfig={{
                  provided,
                  snapshot
                }}
              />
            )}
          </Draggable>
        ))
      )}
    </div>
  );
};