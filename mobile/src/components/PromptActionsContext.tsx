import { createContext, useContext } from 'react';
import type { ModelInfo } from '../services/modelService';

export interface PromptActions {
  models: ModelInfo[] | null;
  modelsError: boolean;
  favoriteIds: Set<string>;
  onRetryModels: () => void;
  onSave: (id: string, updates: { name: string; text: string; model: string }) => Promise<void>;
  onSetDefault: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
}

const PromptActionsContext = createContext<PromptActions | null>(null);

export const PromptActionsProvider = PromptActionsContext.Provider;

export function usePromptActions(): PromptActions {
  const ctx = useContext(PromptActionsContext);
  if (!ctx) throw new Error('usePromptActions must be used within PromptActionsProvider');
  return ctx;
}
