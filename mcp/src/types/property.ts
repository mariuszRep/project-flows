export interface SchemaProperty {
  type: string;
  description: string;
  dependencies?: string[];
  execution_order?: number;
  created_by?: string;
  updated_by?: string;
  created_at?: Date;
  updated_at?: Date;
  id?: number;
  template_id?: number;
  fixed?: boolean;
}

export interface SchemaProperties {
  [key: string]: SchemaProperty;
}

export interface ExecutionChainItem {
  execution_order: number;
  prop_name: string;
  prop_config: SchemaProperty;
}