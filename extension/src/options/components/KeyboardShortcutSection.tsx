import { useState, useEffect } from 'react';

const COMMAND_NAME = '_execute_action';

/**
 * Detect if the user is on macOS using userAgent string.
 */
function isMacOS(): boolean {
  return navigator.userAgent.toLowerCase().includes('mac');
}

/**
 * Format shortcut for display.
 * On Mac, converts to symbols. On other platforms, shows text format.
 */
function formatShortcut(shortcut: string): string {
  if (!isMacOS()) return shortcut;

  // Convert to Mac symbols
  return shortcut
    .replace(/Command/g, '\u2318')
    .replace(/Cmd/g, '\u2318')
    .replace(/Ctrl/g, '\u2303')
    .replace(/Alt/g, '\u2325')
    .replace(/Option/g, '\u2325')
    .replace(/Shift/g, '\u21E7')
    .replace(/\+/g, '');
}

export function KeyboardShortcutSection(): React.JSX.Element {
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchShortcut = () => {
      chrome.commands.getAll().then((commands) => {
        const command = commands.find((c) => c.name === COMMAND_NAME);
        setShortcut(command?.shortcut ?? null);
        setIsLoading(false);
      }).catch(() => {
        setShortcut(null);
        setIsLoading(false);
      });
    };

    fetchShortcut();

    // Re-fetch when window gains focus (user may have changed shortcut)
    const handleFocus = () => { fetchShortcut(); };
    window.addEventListener('focus', handleFocus);
    return () => { window.removeEventListener('focus', handleFocus); };
  }, []);

  const handleChangeShortcut = () => {
    // Open Chrome's keyboard shortcuts page
    void chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  };

  const displayShortcut = shortcut ? formatShortcut(shortcut) : 'Not set';

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-700">Keyboard Shortcut</span>
        <kbd className="px-2 py-1 bg-gray-100 border border-gray-200 rounded text-sm font-mono text-gray-700">
          {isLoading ? '...' : displayShortcut}
        </kbd>
        <span className="text-xs text-gray-500">Opens side panel</span>
      </div>
      <button
        onClick={handleChangeShortcut}
        className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
      >
        Change
      </button>
    </div>
  );
}
