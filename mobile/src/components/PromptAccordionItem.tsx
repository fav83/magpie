import { useState, useRef, useEffect } from 'react';
import type { Prompt } from '../types/prompt';
import { validatePromptName, validatePromptText } from '../services/promptStorage';
import { usePromptActions } from './PromptActionsContext';

interface PromptAccordionItemProps {
  prompt: Prompt;
  isExpanded: boolean;
  onToggle: () => void;
  autoFocusName?: boolean;
}

export function PromptAccordionItem({
  prompt,
  isExpanded,
  onToggle,
  autoFocusName = false,
}: PromptAccordionItemProps): React.JSX.Element {
  const { models, modelsError, favoriteIds, onRetryModels, onSave, onSetDefault, onDuplicate, onDelete, onReset } = usePromptActions();
  const [name, setName] = useState(prompt.name);
  const [text, setText] = useState(prompt.text);
  const [model, setModel] = useState(prompt.model);
  const [nameError, setNameError] = useState('');
  const [textError, setTextError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Reset local state when prompt changes (e.g., after external save/reset)
  useEffect(() => {
    setName(prompt.name);
    setText(prompt.text);
    setModel(prompt.model);
    setNameError('');
    setTextError('');
  }, [prompt.name, prompt.text, prompt.model]);

  useEffect(() => {
    if (isExpanded && autoFocusName && nameRef.current) {
      nameRef.current.focus();
    }
  }, [isExpanded, autoFocusName]);

  const hasChanges = name !== prompt.name || text !== prompt.text || model !== prompt.model;

  const handleSave = async () => {
    setNameError('');
    setTextError('');

    const nameResult = validatePromptName(name);
    const textResult = validatePromptText(text);

    if (!nameResult.valid) {
      setNameError(nameResult.error);
    }
    if (!textResult.valid) {
      setTextError(textResult.error);
    }
    if (!nameResult.valid || !textResult.valid) {
      return;
    }

    setSaving(true);
    await onSave(prompt.id, { name, text, model });
    setSaving(false);
  };

  const badges: string[] = [];
  if (prompt.isDefault) badges.push('Default');
  if (prompt.isSystem) badges.push('System');

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400">{isExpanded ? '\u25BC' /* ▼ */ : '\u25B6' /* ▶ */}</span>
          <span className="text-sm font-medium text-gray-800 truncate">{prompt.name}</span>
          {badges.map((badge) => (
            <span
              key={badge}
              className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0"
            >
              {badge}
            </span>
          ))}
        </div>
      </button>

      {/* Expanded Editor */}
      {isExpanded && (
        <div className="px-4 py-4 space-y-4 bg-white">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={prompt.isSystem}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            />
            {nameError && <p className="text-xs text-red-600 mt-1">{nameError}</p>}
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
            {modelsError && !models ? (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <span>Failed to load models</span>
                <button
                  type="button"
                  onClick={onRetryModels}
                  className="text-blue-600 underline text-xs"
                >
                  Retry
                </button>
              </div>
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                {/* Always show current model if not in list */}
                {models && !models.some((m) => m.id === model) && (
                  <option value={model}>{model}</option>
                )}
                {models ? (
                  <>
                    {(() => {
                      const favModels = models.filter((m) => favoriteIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
                      const otherModels = models.filter((m) => !favoriteIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name));
                      return (
                        <>
                          {favModels.length > 0 && (
                            <optgroup label="Favorites">
                              {favModels.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </optgroup>
                          )}
                          {otherModels.length > 0 && (
                            <optgroup label="All Models">
                              {otherModels.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <option value={model}>{model}</option>
                )}
              </select>
            )}
          </div>

          {/* Prompt Text */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prompt</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={prompt.isSystem}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500 resize-y"
            />
            {textError && <p className="text-xs text-red-600 mt-1">{textError}</p>}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!hasChanges || saving}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                !hasChanges || saving
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>

            {!prompt.isDefault && (
              <button
                type="button"
                onClick={() => onSetDefault(prompt.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Set Default
              </button>
            )}

            <button
              type="button"
              onClick={() => onDuplicate(prompt.id)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Duplicate
            </button>

            {!prompt.isSystem && (
              <button
                type="button"
                onClick={() => onDelete(prompt.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            )}

            {prompt.isBuiltIn && prompt.isModified && (
              <button
                type="button"
                onClick={() => onReset(prompt.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
              >
                Reset to original
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
