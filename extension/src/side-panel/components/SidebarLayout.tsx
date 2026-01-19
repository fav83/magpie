import { Tooltip } from './Tooltip';
import { SettingsIcon } from './Icons';

function openOptions(): void {
  void chrome.runtime.openOptionsPage();
}

interface SidebarLayoutProps {
  children: React.ReactNode;
  /** Extra buttons to render before the settings button */
  footerButtons?: React.ReactNode;
  /** Whether content should be centered vertically (for empty states) */
  centerContent?: boolean;
}

/**
 * Common layout wrapper for the sidebar with consistent footer.
 * Handles the full-height flex layout and settings button.
 */
export function SidebarLayout({
  children,
  footerButtons,
  centerContent = false,
}: SidebarLayoutProps): React.JSX.Element {
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Main content area */}
      <div
        className={`flex-1 overflow-y-auto ${
          centerContent ? 'flex items-center justify-center' : ''
        }`}
      >
        {children}
      </div>

      {/* Sticky footer with settings */}
      <div className="flex-shrink-0 border-t border-gray-100 px-2 py-1.5 flex gap-1">
        {footerButtons}
        <Tooltip content="Settings">
          <button
            onClick={openOptions}
            aria-label="Settings"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
