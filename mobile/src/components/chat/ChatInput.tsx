import { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps): React.JSX.Element {
  const [text, setText] = useState('');
  const textRef = useRef(text);
  textRef.current = text;

  const handleSend = useCallback(() => {
    const trimmed = textRef.current.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }, [disabled, onSend]);

  return (
    <div className="flex gap-2 items-end">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
          }
        }}
        placeholder="Ask about this video..."
        disabled={disabled}
        className="flex-1 min-w-0 rounded-full border border-gray-300 px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
      />
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          handleSend();
        }}
        disabled={disabled || !text.trim()}
        className="shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-40 transition-opacity"
        aria-label="Send message"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
