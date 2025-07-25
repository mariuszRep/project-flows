interface ConnectionSettings {
  serverUrl: string;
  autoConnect: boolean;
  maxRetryAttempts: number;
  retryBaseDelay: number;
  lastConnectionTimestamp?: number;
  version: number;
}

const STORAGE_KEY = 'mcp-connection-settings';
const CURRENT_VERSION = 1;

const DEFAULT_SETTINGS: ConnectionSettings = {
  serverUrl: 'http://localhost:3001/sse',
  autoConnect: true,
  maxRetryAttempts: 5,
  retryBaseDelay: 1000,
  version: CURRENT_VERSION,
};

export const storageService = {
  saveConnectionSettings(settings: Partial<ConnectionSettings>): void {
    try {
      const existingSettings = this.loadConnectionSettings();
      const updatedSettings: ConnectionSettings = {
        ...existingSettings,
        ...settings,
        version: CURRENT_VERSION,
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.warn('Failed to save connection settings:', error);
    }
  },

  loadConnectionSettings(): ConnectionSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return DEFAULT_SETTINGS;
      }

      const parsed = JSON.parse(stored) as ConnectionSettings;
      
      // Validate required fields
      if (!this.isValidSettings(parsed)) {
        console.warn('Invalid stored settings, using defaults');
        return DEFAULT_SETTINGS;
      }

      // Handle version migration if needed
      if (parsed.version !== CURRENT_VERSION) {
        const migrated = this.migrateStorageFormat(parsed);
        this.saveConnectionSettings(migrated);
        return migrated;
      }

      return parsed;
    } catch (error) {
      console.warn('Failed to load connection settings, using defaults:', error);
      return DEFAULT_SETTINGS;
    }
  },

  clearConnectionSettings(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear connection settings:', error);
    }
  },

  updateLastConnection(): void {
    this.saveConnectionSettings({
      lastConnectionTimestamp: Date.now(),
    });
  },

  isValidSettings(settings: any): settings is ConnectionSettings {
    return (
      typeof settings === 'object' &&
      typeof settings.serverUrl === 'string' &&
      typeof settings.autoConnect === 'boolean' &&
      typeof settings.maxRetryAttempts === 'number' &&
      typeof settings.retryBaseDelay === 'number' &&
      typeof settings.version === 'number' &&
      settings.serverUrl.length > 0 &&
      settings.maxRetryAttempts > 0 &&
      settings.retryBaseDelay > 0
    );
  },

  migrateStorageFormat(oldSettings: any): ConnectionSettings {
    // Handle future version migrations here
    return {
      ...DEFAULT_SETTINGS,
      ...oldSettings,
      version: CURRENT_VERSION,
    };
  },
};

export type { ConnectionSettings };