import { useState, useCallback, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  fontSize: number;
}

export function ChatInput({
  onSend,
  onCancel,
  isStreaming,
  disabled = false,
  fontSize,
}: ChatInputProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when not streaming
  useEffect(() => {
    if (!isStreaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isStreaming]);

  const handleSubmit = useCallback(() => {
    if (value.trim() && !isStreaming && !disabled) {
      onSend(value);
      setValue('');
    }
  }, [value, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => { setValue(e.target.value); }}
        onKeyDown={handleKeyDown}
        placeholder="Ask about this video..."
        disabled={isStreaming || disabled}
        style={{ fontSize }}
        className={`flex-1 px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          isStreaming || disabled ? 'bg-gray-100 text-gray-500' : 'bg-white'
        }`}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          Cancel
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
            value.trim() && !disabled
              ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
              : 'text-gray-300 cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
