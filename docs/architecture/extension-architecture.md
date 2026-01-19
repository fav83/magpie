# Magpie — Extension Architecture

**Document Version:** 1.8
**Last Updated:** 2026-01-18

---

## 1. Overview

This document describes the foundational architecture for the Magpie Chrome extension. It defines patterns, conventions, and technical decisions that persist across versions.

---

## 2. Technology Stack

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| Language | TypeScript | 5.6+ | Strict mode, no `any` |
| Chrome Types | `chrome-types` | Latest | Official Google package |
| Markdown | `react-markdown` | Latest | Render markdown summaries |
| UI Framework | React | 18.x | Side panel interface |
| Styling | Tailwind CSS | 3.4+ | Utility-first |
| Build Tool | Vite | 5.x | Multiple build configs |
| Testing | Vitest | Latest | Unit tests |
| Linting | ESLint | 9+ | Strictest config |
| Formatting | Prettier | Latest | Consistent style |

---

## 3. Typing Philosophy

We prioritize **static typing** throughout the codebase:

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### ESLint Configuration

- `tseslint.configs.strictTypeChecked` — Strictest type-aware rules
- `tseslint.configs.stylisticTypeChecked` — Style consistency
- `eslint-plugin-react-hooks` — React hooks rules
- `eslint-plugin-react-refresh` — Fast refresh support
- Zero warnings policy (`--max-warnings 0`)

### Type Packages

- `chrome-types` — Chrome extension APIs (official Google package)
- `@openrouter/ai-sdk-provider` — OpenRouter API types (auto-generated from OpenAPI)

---

## 4. Project Structure

```
magpie/
├── docs/
│   └── architecture/           # This document
│
├── extension/
│   ├── public/                 # Static assets
│   │   ├── manifest.json
│   │   ├── icons/
│   │   ├── side-panel.html
│   │   └── options.html
│   │
│   ├── src/
│   │   ├── side-panel/         # React UI for side panel
│   │   │   ├── index.tsx                 # Entry point
│   │   │   ├── App.tsx                   # Side panel root
│   │   │   ├── components/
│   │   │   │   ├── AccordionContainer.tsx  # Accordion list manager
│   │   │   │   ├── AccordionContent.tsx    # Accordion content wrapper
│   │   │   │   ├── AccordionHeader.tsx     # Shared accordion header
│   │   │   │   ├── AccordionItem.tsx       # Single accordion entry
│   │   │   │   ├── AccordionSkeleton.tsx   # Loading skeleton
│   │   │   │   ├── ActionRow.tsx           # Selectors and copy button
│   │   │   │   ├── ApiKeySetup.tsx         # Inline API key input form
│   │   │   │   ├── CompactModelSelector.tsx # Inline model dropdown
│   │   │   │   ├── CopyButton.tsx          # Copy-to-clipboard component
│   │   │   │   ├── EmptyState.tsx          # No summaries message
│   │   │   │   ├── Error.tsx               # Error display component
│   │   │   │   ├── GeneratePanel.tsx       # Prompt/model selectors with generate button
│   │   │   │   ├── Icons.tsx               # Reusable SVG icons
│   │   │   │   ├── InlineError.tsx         # Error within accordion item
│   │   │   │   ├── Loading.tsx             # Loading spinner
│   │   │   │   ├── PromptEditor.tsx        # Inline prompt editor
│   │   │   │   ├── PromptEditorSection.tsx # Prompt editor section wrapper
│   │   │   │   ├── PromptSelector.tsx      # Prompt dropdown
│   │   │   │   ├── RegeneratingSkeleton.tsx # Regeneration loading state
│   │   │   │   ├── SidebarLayout.tsx       # Common layout wrapper with footer
│   │   │   │   ├── StreamingAccordionItem.tsx # Streaming summary entry
│   │   │   │   ├── StreamingContent.tsx    # Streaming markdown renderer
│   │   │   │   ├── SummaryContent.tsx      # Summary display component
│   │   │   │   ├── Tooltip.tsx             # Accessible tooltip component
│   │   │   │   ├── VideoUrlButton.tsx      # Clickable video URL
│   │   │   │   └── chat/                   # Chat feature components
│   │   │   │       ├── ChatHeader.tsx      # Chat section header
│   │   │   │       ├── ChatInput.tsx       # Chat message input
│   │   │   │       ├── ChatMessage.tsx     # Single chat message
│   │   │   │       ├── ChatMessages.tsx    # Chat message list
│   │   │   │       ├── ChatSection.tsx     # Chat container
│   │   │   │       └── index.ts            # Barrel export
│   │   │   ├── hooks/
│   │   │   │   ├── useAccordion.ts         # Accordion state management (composition hook)
│   │   │   │   ├── useAccordionItems.ts    # Item state, expansion, errors
│   │   │   │   ├── usePromptEditor.ts      # Prompt editor state
│   │   │   │   ├── usePromptModelSelection.ts # Prompt/model state coordination
│   │   │   │   ├── useStreamingSummary.ts  # Stream generation logic
│   │   │   │   ├── useVideoChat.ts         # Chat functionality hook
│   │   │   │   └── useVideoNavigation.ts   # Current video detection
│   │   │   └── utils/
│   │   │       └── videoHelpers.ts         # Video-related utilities
│   │   ├── options/            # React UI for settings
│   │   │   ├── index.tsx                   # Entry point
│   │   │   ├── App.tsx                     # Options page root
│   │   │   └── components/
│   │   │       ├── ApiKeyForm.tsx          # API key input
│   │   │       ├── ChatSettings.tsx        # Chat feature settings
│   │   │       ├── ConfirmationModal.tsx   # Confirmation dialog
│   │   │       ├── DangerZoneSection.tsx   # Destructive actions section
│   │   │       ├── DisplaySettings.tsx     # Font size configuration
│   │   │       ├── KeyboardShortcutSection.tsx # Keyboard shortcut info
│   │   │       ├── ModelSelector.tsx       # Searchable model dropdown
│   │   │       ├── PromptActions.tsx       # Prompt action buttons
│   │   │       ├── PromptEditor.tsx        # Prompt text editor
│   │   │       ├── PromptListItem.tsx      # Single prompt in list
│   │   │       ├── PromptListPanel.tsx     # Prompt list container
│   │   │       ├── PromptsSection.tsx      # Prompts management section
│   │   │       └── SettingsSection.tsx     # Settings section wrapper
│   │   ├── content-script/     # YouTube page scripts
│   │   │   ├── capture.ts                  # Page data capture
│   │   │   └── transcript.ts               # Transcript extraction
│   │   ├── service-worker/     # Background coordinator
│   │   │   ├── index.ts                    # Message handlers with validation helpers
│   │   │   ├── chatHandler.ts              # Chat message processing
│   │   │   ├── openrouterApi.ts            # OpenRouter API client
│   │   │   ├── sseParser.ts                # Server-sent events parser
│   │   │   ├── streamingHandler.ts         # SSE stream processing
│   │   │   ├── transcriptExtractor.ts      # Transcript extraction logic
│   │   │   └── videoInfoExtractor.ts       # Video title extraction
│   │   ├── types/              # Shared type definitions
│   │   │   ├── accordion.ts    # AccordionItem interface
│   │   │   ├── chat.ts         # Chat message types
│   │   │   ├── messages.ts     # Message protocol types
│   │   │   ├── models.ts       # OpenRouter model types
│   │   │   ├── prompt.ts       # Prompt and cache types
│   │   │   ├── streaming.ts    # StreamingItem interface
│   │   │   ├── summary.ts      # Summary data types
│   │   │   ├── transcript.ts   # Transcript types
│   │   │   └── index.ts        # Barrel export
│   │   ├── hooks/              # Shared React hooks
│   │   │   ├── useApiKeyForm.ts      # Shared API key form logic
│   │   │   ├── useBufferedMarkdown.ts # Buffered markdown rendering
│   │   │   ├── useChatPort.ts        # Chat port connection
│   │   │   ├── useChromeStorage.ts   # Chrome storage hook
│   │   │   ├── useDropdownState.ts   # Dropdown state management
│   │   │   ├── useFontSize.ts        # Font size preference hook
│   │   │   ├── useModelPreferences.ts # Preferred models hook
│   │   │   ├── useModelSelector.ts   # Model selection logic
│   │   │   └── useStreamingPort.ts   # Streaming port connection
│   │   ├── components/         # Shared UI components
│   │   │   └── model-selector/ # Model selector components
│   │   │       ├── FreeBadge.tsx         # Free model indicator
│   │   │       ├── ModelList.tsx         # Model list container
│   │   │       ├── ModelRow.tsx          # Single model row
│   │   │       ├── StarButton.tsx        # Favorite toggle button
│   │   │       ├── ToggleSwitch.tsx      # Toggle switch component
│   │   │       ├── UnavailableModelRow.tsx # Unavailable model display
│   │   │       └── index.ts              # Barrel export
│   │   ├── utils/              # Shared utilities
│   │   │   ├── accordionStorage.ts   # Accordion item persistence
│   │   │   ├── apiKeyValidation.ts   # API key validation utility
│   │   │   ├── chatStorage.ts        # Chat history persistence
│   │   │   ├── chromeStorage.ts      # Chrome storage wrapper
│   │   │   ├── clipboard.ts          # Clipboard formatting utility
│   │   │   ├── formatTimestamp.ts    # Relative time formatting
│   │   │   ├── freeFilterStorage.ts  # Free models filter persistence
│   │   │   ├── jsonExtractor.ts      # Extract JSON from page
│   │   │   ├── logger.ts             # Debug logging
│   │   │   ├── migration.ts          # Cache migration utility
│   │   │   ├── modelsApi.ts          # OpenRouter models API client
│   │   │   ├── preferredModelsStorage.ts # Preferred models persistence
│   │   │   ├── promptStorage.ts      # Prompt CRUD operations
│   │   │   ├── transcriptParser.ts   # Parse transcript XML
│   │   │   ├── urlHelpers.ts         # URL utilities
│   │   │   └── youtube.ts            # YouTube-specific helpers
│   │   └── config.ts           # Environment configuration
│   │
│   ├── tests/                  # Test files
│   ├── dist/                   # Build output
│   │
│   ├── vite.config.ts          # Service worker build
│   ├── vite.content.config.ts  # Content script build
│   ├── vite.capture.config.ts  # Capture script build
│   ├── vite.sidepanel.config.ts
│   ├── vite.options.config.ts
│   ├── vitest.config.ts        # Test configuration
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── eslint.config.js
│   ├── prettier.config.js
│   └── package.json
│
└── README.md
```

---

## 5. Component Architecture

The extension follows Chrome's Manifest V3 architecture with clear separation of concerns:

### 5.1 Service Worker

**Role:** Central coordinator and API gateway

- Listens for extension icon clicks
- Routes messages between components
- Makes external API calls (avoids CORS in content scripts)
- Accesses `chrome.storage` for configuration

**Build:** ES Module format

### 5.2 Content Script

**Role:** Page interaction layer

- Injected into target pages (YouTube)
- Extracts data from the page DOM or JavaScript context
- Responds to messages from service worker
- Minimal footprint — no React, no heavy dependencies

**Build:** IIFE format (isolated scope)

### 5.3 Side Panel

**Role:** Primary user interface

- React application rendered in Chrome's native Side Panel
- Displays results, loading states, and errors
- Communicates with service worker via messages

**Build:** Standard Vite React build

### 5.4 Options Page

**Role:** Configuration interface

- React application for extension settings
- Manages API keys and preferences
- Stores configuration in `chrome.storage.local`

**Build:** Standard Vite React build

---

## 6. Message Protocol Pattern

Components communicate via typed message passing:

### Pattern

```typescript
// Request: { type: 'ACTION_NAME', ...payload }
// Response: { type: 'ACTION_SUCCESS', ...data } | { type: 'ACTION_ERROR', error: string }
```

### Principles

1. **Discriminated unions** — Each message has a `type` field for type narrowing
2. **Request/Response pairs** — Every request type has corresponding success/error responses
3. **Centralized definitions** — All message types in `src/types/messages.ts`
4. **No `any`** — Full type safety across component boundaries

### Example

```typescript
// Request
type GetDataRequest = {
  type: 'GET_DATA';
  id: string;
};

// Response
type GetDataResponse =
  | { type: 'GET_DATA_SUCCESS'; data: Data }
  | { type: 'GET_DATA_ERROR'; error: string };
```

---

## 7. Build Strategy

### Multiple Vite Configurations

Different components require different build outputs:

| Component | Config | Format | Reason |
|-----------|--------|--------|--------|
| Service Worker | `vite.config.ts` | ES Module | Chrome MV3 requires module workers |
| Content Script | `vite.content.config.ts` | IIFE | Isolated scope, no module system on page |
| Capture Script | `vite.capture.config.ts` | IIFE | Page data capture, isolated scope |
| Side Panel | `vite.sidepanel.config.ts` | ES Module | Standard React build |
| Options | `vite.options.config.ts` | ES Module | Standard React build |

### Build Output

All builds output to `dist/` directory, which is loaded as an unpacked extension during development.

### Development Workflow

- Parallel watch mode for all configs
- Load `dist/` as unpacked extension in Chrome
- Reload extension after changes

---

## 8. Storage Pattern

### Chrome Storage API

Use `chrome.storage.local` for persistent data:

```typescript
// Write
await chrome.storage.local.set({ key: value });

// Read
const { key } = await chrome.storage.local.get('key');

// Listen for changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.key) {
    // Handle change
  }
});
```

### What to Store

- API keys and credentials
- User preferences
- Cached data (with TTL if needed)

### What NOT to Store

- Sensitive data without encryption
- Large blobs (use IndexedDB instead)
- Temporary state (use React state)

---

## 9. Error Handling Pattern

### Principles

1. **Fail gracefully** — Never crash, always show user-friendly message
2. **Typed errors** — Use discriminated unions, not thrown exceptions for expected failures
3. **Log for debugging** — Console logs in development only; production builds are silent
4. **User clarity** — Error messages explain what happened and what to do

### Pattern

```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

---

## 10. Logging System

### Overview

The extension uses a centralized logging system (`src/utils/logger.ts`) that controls all console output based on build mode.

### Build Mode Detection

**Important:** Vite's `import.meta.env.DEV` is only `true` when running `vite dev` (the dev server), NOT when running `vite build --mode development`. Since Chrome extensions must be built (not served), we use `import.meta.env.MODE` instead:

```typescript
// Correct way to detect development build
const ENABLE_LOGGING = import.meta.env.MODE === 'development';

// Wrong - only true for vite dev server, not vite build
const WRONG = import.meta.env.DEV;
```

### Logging Modes

| Command | `import.meta.env.MODE` | Logging |
|---------|------------------------|---------|
| `npm run dev` | `'development'` | Enabled |
| `npm run build` | `'production'` | Disabled |
| `npm test` | `'test'` | Enabled |

### Logger API

```typescript
import { log, logError, logWarn, logComponent } from '../utils/logger';

// Basic logging (prefixed with [YT-Summarizer])
log('Message', data);           // console.log
logError('Error', error);       // console.error
logWarn('Warning', data);       // console.warn

// Component-specific logging (prefixed with [YT-Summarizer][ComponentName])
logComponent('VideoNavigation', 'Video changed:', videoId);
```

### Runtime Debug Logging

For production debugging, logging can be enabled at runtime via Chrome storage:

```javascript
// Enable in browser console
chrome.storage.local.set({ DEBUG_LOGGING: true });

// Disable
chrome.storage.local.remove('DEBUG_LOGGING');
```

### Page Context Scripts

Scripts executed via `chrome.scripting.executeScript` run in the page context where `import.meta.env` is not available. For these, pass a `debugMode` parameter:

```typescript
// In service worker
await chrome.scripting.executeScript({
  target: { tabId },
  world: 'MAIN',
  func: extractTranscriptInPage,
  args: [videoId, import.meta.env.MODE === 'development'],
});

// In the injected function
function extractTranscriptInPage(videoId: string, debugMode: boolean) {
  const log = (msg: string) => { if (debugMode) console.log('[YT-Summarizer]', msg); };
  // ...
}
```

### Content Script Logging

Content scripts (`capture.ts`) check the mode directly since they're bundled separately:

```typescript
const DEBUG_MODE = import.meta.env.MODE === 'development';
```

### Best Practices

1. **Always use the logger utilities** — Never use `console.log` directly
2. **Use `logComponent` for component-specific logs** — Easier filtering in DevTools
3. **Pass `debugMode` to page context functions** — `import.meta.env` isn't available there
4. **Keep production builds silent** — All logging disabled for end users

---

## 11. Implemented Enhancements

The following enhancements have been implemented:

- **Multi-prompt support** — Users can create multiple prompts and switch between them
- **Per-prompt model selection** — Each prompt can use a different LLM model from OpenRouter
- **Accordion sidebar with history** — Last 20 summaries displayed in expandable accordion
- **Cross-video summary history** — Summaries persist across video navigation
- **SPA navigation support** — Auto-refresh summary when navigating between YouTube videos
- **Markdown rendering** — Summaries rendered with proper formatting
- **Context length validation** — Error handling for transcripts exceeding model context limits
- **Reliable video title extraction** — Multiple fallback sources for accurate titles
- **Configurable font size** — User-selectable summary text size (6-24px slider)
- **Preferred models** — Star/favorite models for quick access in model selector dropdown
- **Storage key consolidation** — Centralized `STORAGE_KEYS` constant for all storage operations
- **Streaming responses** — Real-time streaming for summary generation with cancel support
- **Shared UI components** — Extracted reusable components (Icons, CopyButton, AccordionHeader, Tooltip)
- **Free models filter** — Toggle to show only free OpenRouter models in selector
- **API key validation** — Test button to validate API key before saving
- **Settings footer** — Quick access to settings and expand/collapse all from sidebar
- **Copy includes metadata** — Clipboard includes video title and URL with summary
- **Summary regeneration** — Replace existing summary when regenerating with different prompt
- **Inline error handling** — Error states shown within accordion with retry/regenerate options
- **Model override** — Change model independently from prompt's default model
- **OpenRouter error details** — Display specific API error messages for troubleshooting
- **Inline API key setup** — First-run onboarding with inline API key form in sidebar
- **Auto-generation guard** — Prevents auto-summarization when no API key is configured
- **Network error fallback** — "Save anyway" option when API key validation fails due to network issues
- **Transcript chat** — Ask follow-up questions about video content with chat interface

## 12. Future Considerations

This architecture supports future enhancements:

- **Multiple LLM providers** — Swap OpenRouter client for others
- **Audio transcription** — Add new content script capabilities
- **Sync across devices** — Switch to `chrome.storage.sync`
- **More platforms** — Add content scripts for other video sites
- **Cache eviction** — LRU or TTL-based cache management

---

## References

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Side Panel API](https://developer.chrome.com/docs/extensions/reference/sidePanel/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [typescript-eslint](https://typescript-eslint.io/)
- [OpenRouter API Documentation](https://openrouter.ai/docs)
