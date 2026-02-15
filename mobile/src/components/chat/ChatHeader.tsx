import { useState, useEffect, useRef } from 'react';
import { ConfirmDialog } from '../ConfirmDialog';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';
import { formatChatConversation } from '../../utils/formatChat';
import type { ChatMessage } from '../../types/chat';

interface ChatHeaderProps {
  messages: ChatMessage[];
  onClear: () => void;
}

export function ChatHeader({ messages, onClear }: ChatHeaderProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { copied, copy } = useCopyToClipboard();

  const handleCopyAll = () => {
    copy(formatChatConversation(messages));
    setMenuOpen(false);
  };

  // Close menu on outside tap
  useEffect(() => {
    if (!menuOpen) return;
    const handleTap = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleTap);
    return () => document.removeEventListener('pointerdown', handleTap);
  }, [menuOpen]);

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Chat actions"
        >
          {copied ? (
            <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
            <button
              type="button"
              onClick={handleCopyAll}
              className="w-full text-left text-sm text-gray-700 hover:bg-gray-100 px-3 py-2"
            >
              Copy all
            </button>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setShowConfirm(true); }}
              className="w-full text-left text-sm text-red-600 hover:bg-gray-100 px-3 py-2"
            >
              Clear
            </button>
          </div>
        )}
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
