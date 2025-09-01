/**
 * Type definitions for the UnifiedForm component
 * 
 * This file defines the interfaces and types used by the UnifiedForm component
 * which provides a single, dynamic form solution for both tasks and projects.
 */

import { TaskStage } from './task';

/**
 * Represents the type of entity being managed by the form
 */
export type EntityType = 'task' | 'project' | 'epic';

/**
 * Represents the mode of the form operation
 */
export type FormMode = 'create' | 'edit';

/**
 * Template property as returned from the MCP server
 */
export interface TemplateProperty {
  id: number;
  template_id: number;
  key: string;
  type: string;
  description: string;
  dependencies: string[];
  execution_order: number;
  fixed: boolean;
}

/**
 * Form field definition generated from template properties
 */
export interface FormField {
  name: string;
  label: string;
  description: string;
  type: 'input' | 'textarea' | 'select';
  required: boolean;
  placeholder: string;
  order: number;
}

/**
 * Props for the UnifiedForm component
 */
export interface UnifiedFormProps {
  /** The type of entity being managed (task or project) */
  entityType: EntityType;
  
  /** The mode of operation (create or edit) */
  mode: FormMode;
  
  /** The ID of the entity being edited (only required for edit mode) */
  entityId?: number;
  
  /** Override template ID (defaults to 1 for tasks, 2 for projects, 3 for epics) */
  templateId?: number;
  
  /** Initial stage for tasks (only applies to task entities) */
  initialStage?: TaskStage;
  
  /** Callback called when form submission succeeds */
  onSuccess?: (entity: any) => void;
  
  /** Callback called when form is cancelled */
  onCancel?: () => void;
  
  /** Callback called when delete is requested */
  onDelete?: (entityId: number, entityTitle: string) => void;
  
  /** Controls visibility of the form */
  isOpen?: boolean;
}

/**
 * Delete dialog state interface
 */
export interface DeleteDialogState {
  isOpen: boolean;
  entityId: number | null;
  entityTitle: string;
}

/**
 * Form data record type - keys are field names, values are field values
 */
export type FormData = Record<string, any>;

/**
 * Field type mapping for different input types
 */
export type FieldTypeMap = {
  input: HTMLInputElement;
  textarea: HTMLTextAreaElement;
  select: HTMLSelectElement;
};

/**
 * Field value type union
 */
export type FieldValue = string | number | null | undefined;