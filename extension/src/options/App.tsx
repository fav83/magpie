import { ApiKeyForm } from './components/ApiKeyForm';
import { DisplaySettings } from './components/DisplaySettings';
import { KeyboardShortcutSection } from './components/KeyboardShortcutSection';
import { PromptsSection } from './components/PromptsSection';
import { ChatSettings } from './components/ChatSettings';
import { DangerZoneSection } from './components/DangerZoneSection';

const APP_VERSION = '1.0.0';

export function App(): React.JSX.Element {
  return (
    <div className="options-container p-8 space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-semibold text-gray-900">Magpie Settings</h1>

      {/* Top Settings - Side by side */}
      <div className="grid grid-cols-2 gap-6">
        {/* API Key Column */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <ApiKeyForm />
        </div>

        {/* Display Settings Column */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <DisplaySettings />
        </div>
      </div>

      {/* Keyboard Shortcut */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <KeyboardShortcutSection />
      </div>

      {/* Prompts Section - Takes most of the page */}
      <div className="h-[500px]">
        <PromptsSection />
      </div>

      {/* Chat Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <ChatSettings />
      </div>

      {/* Danger Zone */}
      <DangerZoneSection />

      {/* Footer */}
      <div className="text-center py-4 border-t border-gray-200">
        <span className="text-sm text-gray-400">Magpie v{APP_VERSION}</span>
      </div>
    </div>
  );
}
