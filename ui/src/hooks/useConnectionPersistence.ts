import { useState, useEffect, useCallback } from 'react';
import { storageService, ConnectionSettings } from '../services/storageService';

export const useConnectionPersistence = () => {
  const [settings, setSettings] = useState<ConnectionSettings>(
    storageService.loadConnectionSettings()
  );

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mcp-connection-settings' && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue) as ConnectionSettings;
          setSettings(newSettings);
        } catch (error) {
          console.warn('Failed to parse storage change:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateSettings = useCallback((updates: Partial<ConnectionSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    storageService.saveConnectionSettings(updates);
  }, [settings]);

  const clearSettings = useCallback(() => {
    storageService.clearConnectionSettings();
    setSettings(storageService.loadConnectionSettings());
  }, []);

  const updateLastConnection = useCallback(() => {
    storageService.updateLastConnection();
    setSettings(storageService.loadConnectionSettings());
  }, []);

  return {
    settings,
    updateSettings,
    clearSettings,
    updateLastConnection,
  };
};