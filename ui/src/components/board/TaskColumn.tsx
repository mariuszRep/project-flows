import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { TaskCard } from './TaskCard';
import { Task } from '@/types/task';
import { Project } from '@/types/project';

interface TaskColumnProps {
  title: string;
  tasks: Task[];
  onTaskUpdate: (taskId?: number, newStage?: string) => void;
  onTaskDelete: () => void;
  isDraggingOver?: boolean;
  projects: Project[];
}

export const TaskColumn: React.FC<TaskColumnProps> = ({
  title,
  tasks,
  onTaskUpdate,
  onTaskDelete,
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
              <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                {...provided.dragHandleProps}
                className={`${snapshot.isDragging ? 'rotate-2 scale-105' : ''} transition-transform`}
              >
                <TaskCard
                  task={task}
                  onUpdate={onTaskUpdate}
                  onDelete={onTaskDelete}
                  isDragging={snapshot.isDragging}
                  projects={projects}
                />
              </div>
            )}
          </Draggable>
        ))
      )}
    </div>
  );
};