import { useState, useCallback } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import type { ChatMessage } from '../../types/chat';

interface ChatHeaderProps {
  messages: ChatMessage[];
  onClear: () => void;
}

function formatConversation(messages: ChatMessage[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.content}`)
    .join('\n\n');
}

export function ChatHeader({ messages, onClear }: ChatHeaderProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCopyAll = useCallback(async () => {
    await navigator.clipboard.writeText(formatConversation(messages));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [messages]);

  return (
    <>
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          type="button"
          onClick={() => void handleCopyAll()}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded transition-colors"
        >
          {copied ? 'Copied!' : 'Copy all'}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded transition-colors"
        >
          Clear
        </button>
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Clear chat"
          message="This will delete the entire conversation. This cannot be undone."
          confirmLabel="Clear"
          confirmDestructive
          onConfirm={() => {
            setShowConfirm(false);
            onClear();
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
