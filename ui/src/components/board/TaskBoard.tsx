import React from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { TaskColumn } from './TaskColumn';
import { Task, TaskStage } from '@/types/task';
import { Project } from '@/types/project';

interface TaskBoardProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  onTaskUpdate: (taskId?: number, newStage?: string) => void;
  onTaskDelete: () => void;
  projects: Project[];
}

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  setTasks,
  onTaskUpdate,
  onTaskDelete,
  projects
}) => {
  const stages: { key: TaskStage; title: string; color: string }[] = [
    { key: 'backlog', title: 'Backlog', color: 'border-border bg-surface/50' },
    { key: 'doing', title: 'Doing', color: 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/20' },
    { key: 'review', title: 'Review', color: 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/20' },
    { key: 'completed', title: 'Completed', color: 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/20' }
  ];

  const getTasksByStage = (stage: TaskStage) => {
    return tasks.filter(task => task.stage === stage);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const taskId = parseInt(draggableId);
    const newStage = destination.droppableId as TaskStage;

    const taskToMove = tasks.find(task => task.id === taskId);
    if (!taskToMove) {
      return;
    }

    // Optimistically update the UI
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, stage: newStage } : task
      )
    );

    try {
      // Call the MCP update_task tool
      await onTaskUpdate(taskId, newStage);
    } catch (error) {
      console.error('Error moving task:', error);
      // Revert the UI change on error
      setTasks(prevTasks =>
        prevTasks.map(task => (task.id === taskId ? taskToMove : task))
      );
    }
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
        {stages.map(stage => (
          <Droppable key={stage.key} droppableId={stage.key}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`rounded-lg border-2 border-dashed p-4 min-h-[500px] flex flex-col ${stage.color} ${
                  snapshot.isDraggingOver ? 'border-primary bg-primary/10' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg text-foreground">{stage.title}</h3>
                  <span className="bg-card px-2 py-1 rounded-full text-sm font-medium text-muted-foreground">
                    {getTasksByStage(stage.key).length}
                  </span>
                </div>
                
                <TaskColumn
                  title={stage.title}
                  tasks={getTasksByStage(stage.key)}
                  onTaskUpdate={onTaskUpdate}
                  onTaskDelete={onTaskDelete}
                  isDraggingOver={snapshot.isDraggingOver}
                  projects={projects}
                />
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
};