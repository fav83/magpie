# Magpie Mobile — Configurable Prompts Spec

**Version:** 1.0
**Date:** 2026-02-08

---

## 1. Goal

Bring the Chrome extension's configurable prompts system to the mobile app. Users can select from 14 built-in prompts, create custom prompts, edit/delete/duplicate prompts, and set a default. Each prompt is coupled to a specific AI model. The feature mirrors the extension's behavior with a mobile-native UX.

---

## 2. Scope

### In Scope

- Full set of 14 built-in prompts (copied from extension's `defaultPrompts.json`)
- Prompt CRUD: create, read, update, delete, duplicate
- Prompt-model coupling (each prompt carries its own model ID)
- Prompt selector dropdown on the main screen
- Prompt management screen accessible from Settings (expandable accordion)
- Model selector dropdown within accordion editor (dynamic list from OpenRouter API)
- Default prompt system (Quick Summary as initial default)
- System prompt protection (Quick Summary cannot be deleted or have name/text edited)
- Built-in prompts editable with "Reset to original" option
- Versioned migration system for built-in prompts
- Confirmation dialogs for Delete and Reset actions
- Validation: prompt name non-empty, prompt text must contain `{{transcript}}`

### Out of Scope

- Cross-platform prompt sync (prompts are fully independent per-platform)
- Inline prompt editing during summarization (edit in Settings > Manage Prompts)
- Streaming summary display (remains non-streaming)
- Prompt export/import
- Prompt sharing between devices

---

## 3. Data Model

### Prompt Interface

Identical to the extension's `Prompt` type:

```typescript
interface Prompt {
  id: string;            // UUID for custom, "default-*" for built-ins
  name: string;          // User-facing display name
  text: string;          // Template with {{transcript}} placeholder
  model: string;         // OpenRouter model ID (e.g., "openai/gpt-4o-mini")
  isDefault: boolean;    // True for the currently selected default prompt
  isSystem: boolean;     // True only for Quick Summary (undeletable, name/text read-only)
  isBuiltIn?: boolean;   // True for prompts shipped with the app
  isModified?: boolean;  // True if user has edited a built-in prompt's text or name
}
```

**New field vs extension:** `isModified` tracks whether the user has changed a built-in prompt, enabling the "Reset to original" feature. The extension doesn't have this because it doesn't support reset.

### Storage Shape

Single JSON blob in Capacitor Preferences:

```typescript
// Storage keys
const STORAGE_KEYS = {
  PROMPTS: 'prompts',                           // JSON.stringify(Prompt[])
  DEFAULT_PROMPT_ID: 'default_prompt_id',        // string
  DEFAULT_PROMPTS_VERSION: 'default_prompts_version',  // number
};
```

All prompt data is stored as a single serialized array under the `prompts` key. Reads and writes are atomic.

---

## 4. Built-in Prompts

### Source

Copy `extension/src/data/defaultPrompts.json` into `mobile/src/data/defaultPrompts.json`. This is a one-time copy — the two files are independently versioned and can diverge.

### Full Set (14 prompts)

| ID | Name | Model | System? |
|----|------|-------|---------|
| `default-quick-summary` | Quick Summary | `openai/gpt-4o-mini` | Yes |
| `default-detailed-summary` | Detailed Summary | `openai/gpt-4o-mini` | No |
| `default-tldr` | TLDR | `google/gemini-2.0-flash-lite-001` | No |
| `default-quick-summary-spanish` | Quick Summary (Spanish) | `openai/gpt-4o-mini` | No |
| `default-quick-summary-chinese` | Quick Summary (Chinese) | `openai/gpt-4o-mini` | No |
| `default-quick-summary-polish` | Quick Summary (Polish) | `openai/gpt-4o-mini` | No |
| `default-quick-brief` | Quick Brief | `openai/gpt-4o-mini` | No |
| `default-emoji-summary` | Emoji Summary | `google/gemini-2.0-flash-001` | No |
| `default-explain-simply` | Explain Simply | `anthropic/claude-3.5-haiku` | No |
| `default-action-items` | Action Items | `google/gemini-2.0-flash-001` | No |
| `default-qa` | Q&A | `openai/gpt-4o-mini` | No |
| `default-timestamps` | Timestamps | `google/gemini-2.0-flash-lite-001` | No |
| `default-tweet-thread` | Tweet Thread | `anthropic/claude-3.5-haiku` | No |
| `default-study-notes` | Study Notes | `anthropic/claude-3.5-haiku` | No |

### System Prompt

`default-quick-summary` (Quick Summary) is the system prompt:
- Cannot be deleted (throws error)
- Name and text cannot be edited (model can be changed)
- Always exists — recreated from definition if somehow removed
- Acts as the fallback default if no default is explicitly set

---

## 5. Storage Layer

### File: `mobile/src/services/promptStorage.ts`

Port the extension's `promptStorage.ts` logic, replacing `chrome.storage.local` with Capacitor Preferences.

### Core Functions

```typescript
// Read
getPrompts(): Promise<Prompt[]>              // All prompts, sorted alphabetically
getPromptById(id: string): Promise<Prompt | null>
getDefaultPrompt(): Promise<Prompt>          // Never null (falls back to system prompt)
getDefaultPromptId(): Promise<string>

// Write
savePrompts(prompts: Prompt[]): Promise<void>
setDefaultPromptId(promptId: string): Promise<void>

// CRUD
addPrompt(name: string, text: string, model?: string): Promise<Prompt>
updatePrompt(id: string, updates: Partial<Pick<Prompt, 'name' | 'text' | 'model'>>): Promise<void>
deletePrompt(id: string): Promise<void>
duplicatePrompt(id: string): Promise<Prompt>

// Reset
resetBuiltInPrompt(id: string): Promise<void>   // Restore original text/name from defaultPrompts.json

// Validation
validatePromptName(name: string): ValidationResult
validatePromptText(text: string): ValidationResult

// ID generation
generatePromptId(): string                       // crypto.randomUUID()
```

### Storage Implementation

```typescript
import { Preferences } from '@capacitor/preferences';

// Read prompts from storage
async function loadRawPrompts(): Promise<Prompt[]> {
  const { value } = await Preferences.get({ key: STORAGE_KEYS.PROMPTS });
  return value ? JSON.parse(value) as Prompt[] : [];
}

// Write prompts to storage
async function savePrompts(prompts: Prompt[]): Promise<void> {
  await Preferences.set({
    key: STORAGE_KEYS.PROMPTS,
    value: JSON.stringify(prompts),
  });
}
```

### Sorting

`getPrompts()` always returns prompts sorted alphabetically by `name.localeCompare()`, matching the extension.

### Default Prompt Resolution

1. Read `DEFAULT_PROMPT_ID` from Preferences
2. Find prompt with that ID in storage
3. If not found, fall back to system prompt (`default-quick-summary`)
4. If system prompt missing, recreate from definition
5. Never return null

---

## 6. Migration System

### Overview

Versioned migration system that runs on every `getPrompts()` call. Ensures built-in prompts are added on first launch and updated on app upgrades without losing user customizations.

### Version Tracking

```typescript
const DEFAULT_PROMPTS_VERSION = 4; // Matches extension's current version

// Stored as: Preferences key 'default_prompts_version'
```

### Migration Logic (inside `getPrompts()`)

```
Read stored version
If stored version < DEFAULT_PROMPTS_VERSION:
  1. Run legacy migrations (remove old prompt IDs if present)
  2. For each built-in prompt definition:
     - If prompt ID doesn't exist in storage → add it
     - If prompt ID exists AND user has NOT modified it → leave as-is (*)
     - If prompt ID exists AND user HAS modified it → preserve user version (isModified=true)
  3. Update stored version to DEFAULT_PROMPTS_VERSION
  4. Save prompts

Always:
  - Ensure system prompt exists (safety check)
  - Add default model to any prompts missing the model field
  - Sort alphabetically
```

(*) "Not modified" means `isModified` is falsy. On migration, unmodified built-ins get their text/name updated to the latest definition. Modified built-ins are preserved.

### Conflict Resolution on Upgrade

When a new app version ships updated built-in prompt text:
- **Unmodified built-ins:** Updated to new text silently
- **User-modified built-ins:** Preserved as-is. User can manually "Reset to original" to get the new version
- **User's custom prompts:** Never touched by migrations
- **Missing built-ins:** Added automatically (new prompts in a version upgrade)

---

## 7. Model List (Dynamic)

### Fetching Models

Fetch available models from the OpenRouter API at runtime.

```typescript
// GET https://openrouter.ai/api/v1/models
// Returns array of model objects with id, name, context_length, pricing, etc.
```

### Caching Strategy

Session-only cache:
- Fetch on first access (when user opens prompt editor or management screen)
- Cache in React state / module-level variable
- Refetch on each app launch (no persistence to Preferences)
- No background refresh

### Fallback on Error

When the model list fetch fails (offline, no API key, rate limited):
- Show an error state in the model dropdown
- Display: "Failed to load models" with a "Retry" button
- The currently selected model on the prompt is always shown regardless of fetch status

### Model Dropdown Display

Show model `name` (human-readable) in the dropdown, store model `id` in the prompt. Group by provider if feasible, otherwise flat alphabetical list.

---

## 8. UI — Main Screen Changes

### Prompt Selector Dropdown

Add a native `<select>` dropdown between the URL input and the Summarize button.

```
┌─────────────────────────────────┐
│ Magpie                      ⚙  │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │  Paste YouTube URL        │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │  Quick Summary (Default) ▼│  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │       Summarize           │  │
│  └───────────────────────────┘  │
│                                 │
├─────────────────────────────────┤
│  Summary / Status Area          │
│  (scrollable)                   │
└─────────────────────────────────┘
```

### Dropdown Behavior

- Shows all prompts sorted alphabetically
- Each option displays the prompt name
- The default prompt shows `(Default)` suffix: `"Quick Summary (Default)"`
- Selected prompt determines both the prompt text and model used for summarization
- Disabled during loading states
- Initialized to the default prompt on app mount

### State Management

```typescript
const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

// On mount: load default prompt ID
useEffect(() => {
  void getDefaultPromptId().then(setSelectedPromptId);
}, []);
```

When user selects a prompt from the dropdown, `selectedPromptId` updates. The `handleSummarize` function reads the prompt and model from storage using this ID.

### No Inline Editing

There is no prompt editing capability on the main screen. To modify prompts, the user navigates to Settings > Manage Prompts.

---

## 9. UI — Settings Screen Changes

### Navigation

Add a "Manage Prompts" entry to the existing Settings screen, below the API Key section:

```
┌─────────────────────────────────┐
│ ← Settings                      │
├─────────────────────────────────┤
│                                 │
│  OpenRouter API Key             │
│  ┌───────────────────────────┐  │
│  │ sk-or-•••••••••••••abc    │  │
│  └───────────────────────────┘  │
│  [Test]  [Save]                 │
│                                 │
│  ─────────────────────────────  │
│                                 │
│  Prompts                        │
│  ┌───────────────────────────┐  │
│  │ Manage Prompts          → │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

Tapping "Manage Prompts" navigates to the prompt management screen.

### Page Routing Update

```typescript
type Page = 'main' | 'settings' | 'manage-prompts';
```

---

## 10. UI — Prompt Management Screen

### Layout

Full-screen view with a header and scrollable accordion list.

```
┌─────────────────────────────────┐
│ ← Manage Prompts    [+ Add]    │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ ▶ Action Items            │  │
│  ├───────────────────────────┤  │
│  │ ▼ Detailed Summary        │  │
│  │                           │  │
│  │  Name:                    │  │
│  │  ┌─────────────────────┐  │  │
│  │  │ Detailed Summary    │  │  │
│  │  └─────────────────────┘  │  │
│  │                           │  │
│  │  Model:                   │  │
│  │  ┌─────────────────────┐  │  │
│  │  │ GPT-4o Mini       ▼│  │  │
│  │  └─────────────────────┘  │  │
│  │                           │  │
│  │  Prompt:                  │  │
│  │  ┌─────────────────────┐  │  │
│  │  │ Summarize this      │  │  │
│  │  │ video transcript... │  │  │
│  │  │                     │  │  │
│  │  └─────────────────────┘  │  │
│  │                           │  │
│  │  [Save] [Set Default]     │  │
│  │  [Duplicate] [Delete]     │  │
│  │                           │  │
│  ├───────────────────────────┤  │
│  │ ▶ Emoji Summary           │  │
│  ├───────────────────────────┤  │
│  │ ▶ Explain Simply          │  │
│  │ ...                       │  │
│  └───────────────────────────┘  │
│                                 │
└─────────────────────────────────┘
```

### Accordion Behavior

- Each prompt is a collapsible accordion item
- Tapping the header row toggles expand/collapse
- Only one item expanded at a time (expanding one collapses the previous)
- Collapsed state shows: prompt name + chevron indicator (▶/▼)
- Default prompt shows a "(Default)" badge in the collapsed header
- System prompt shows a "(System)" badge in the collapsed header
- List sorted alphabetically by name

### Expanded Editor Fields

**Name Field:**
- Text input, pre-filled with current name
- Disabled for the system prompt (Quick Summary)
- Validation: non-empty (checked on save)

**Model Selector:**
- Dropdown populated from OpenRouter API (dynamic)
- Shows model display name, stores model ID
- On fetch failure: shows error message + "Retry" button
- Always shows the current model even if fetch fails

**Prompt Text Field:**
- Auto-expanding `<textarea>` that grows with content
- Pre-filled with current prompt text
- Disabled for the system prompt (Quick Summary)
- Must contain `{{transcript}}` (validated on save)

### Action Buttons (inside expanded accordion)

All action buttons are visible inside the expanded accordion item:

| Button | Behavior | Conditions |
|--------|----------|------------|
| **Save** | Validates and persists changes to name, model, text | Always visible. Disabled if no changes. |
| **Set Default** | Marks this prompt as the default | Hidden if already the default |
| **Duplicate** | Creates "Copy of {name}" with same text/model | Always visible |
| **Delete** | Removes prompt after confirmation | Hidden for system prompt |
| **Reset** | Restores built-in prompt to original definition | Visible only for built-in prompts with `isModified: true` |

### Create New Prompt

"+ Add" button in the header bar. Tapping it:

1. Creates a new prompt with empty name, default text (`{{transcript}}`), and model `openai/gpt-4o-mini`
2. Appends it to the list
3. Scrolls to and expands the new item
4. Auto-focuses the name field

### Built-in Prompt Editing

Built-in prompts (except system) can have their name, text, and model edited:
- When a built-in is edited, set `isModified: true`
- Show "Reset to original" button for modified built-ins
- Reset restores text and name from `defaultPrompts.json`, clears `isModified`

### System Prompt Rules

For the system prompt (`default-quick-summary`):
- Name field: disabled (read-only)
- Text field: disabled (read-only)
- Model dropdown: enabled (can change model)
- Delete button: hidden
- Cannot be deleted programmatically (throws error)

---

## 11. Confirmation Dialogs

### Delete Prompt

```
┌─────────────────────────────────┐
│         Delete Prompt?          │
│                                 │
│  Are you sure you want to       │
│  delete "Detailed Summary"?     │
│  This cannot be undone.         │
│                                 │
│       [Cancel]  [Delete]        │
└─────────────────────────────────┘
```

- "Delete" button styled in red
- Triggered by tapping Delete in the accordion

### Reset to Original

```
┌─────────────────────────────────┐
│        Reset Prompt?            │
│                                 │
│  This will restore the original │
│  name and text for              │
│  "Detailed Summary".           │
│  Your changes will be lost.     │
│                                 │
│       [Cancel]  [Reset]         │
└─────────────────────────────────┘
```

- Triggered by tapping "Reset to original" on a modified built-in

---

## 12. Validation

### When Validated

All validation occurs on save attempt only. No real-time validation while typing.

### Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| Name | `name.trim()` is non-empty | "Prompt name cannot be empty." |
| Text | Contains `{{transcript}}` | "Prompt must include {{transcript}} placeholder." |

### Prompt Length

No limit on prompt text length. If the combined prompt + transcript exceeds the model's context window, the user will get an error at summarization time (matching extension behavior).

### Validation UX

On save failure:
- Show error message inline below the invalid field
- Do not close the accordion or navigate away
- Field remains editable for correction

---

## 13. Summarization Flow Changes

### Current Flow

```
handleSummarize()
  → config.prompt.replace('{{transcript}}', transcript)
  → generateSummary(transcript, apiKey)  // uses config.openrouter.model
```

### New Flow

```
handleSummarize()
  → getPromptById(selectedPromptId)
  → prompt.text.replace('{{transcript}}', transcript)
  → generateSummary(transcript, apiKey, prompt.text, prompt.model)
```

### `generateSummary` Signature Change

```typescript
// Before
generateSummary(transcript: string, apiKey: string): Promise<Result>

// After
generateSummary(
  transcript: string,
  apiKey: string,
  promptText: string,
  model: string
): Promise<Result>
```

The function no longer reads prompt or model from `config.ts`. Both are passed explicitly by the caller.

### `config.ts` Changes

Remove the `prompt` and `openrouter.model` fields:

```typescript
// Before
export const config = {
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  prompt: `Summarize in 3-5 short bullet points:...`,
  maxTranscriptChars: 504000,
} as const;

// After
export const config = {
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1',
  },
  defaultModel: 'openai/gpt-4o-mini',    // Used only for new custom prompts
  maxTranscriptChars: 504000,
} as const;
```

---

## 14. App Startup Flow

On mount:

1. Load API key from Preferences (existing)
2. Load prompts via `getPrompts()` (triggers migrations on first launch / upgrade)
3. Load default prompt ID via `getDefaultPromptId()`
4. Set `selectedPromptId` state to the default
5. Render main screen with prompt selector initialized

The user sees the prompt dropdown pre-selected to their default prompt. No action required to start summarizing.

---

## 15. Files Changed

### New Files

| File | Purpose |
|------|---------|
| `src/data/defaultPrompts.json` | 14 built-in prompt definitions (copied from extension) |
| `src/types/prompt.ts` | `Prompt` interface, `SYSTEM_PROMPT_ID` constant |
| `src/services/promptStorage.ts` | Prompt CRUD, migrations, validation |
| `src/services/modelService.ts` | Fetch and cache OpenRouter model list |
| `src/components/ManagePrompts.tsx` | Prompt management screen (accordion) |
| `src/components/PromptAccordionItem.tsx` | Single expandable prompt editor |
| `src/components/ConfirmDialog.tsx` | Reusable confirmation dialog |
| `tests/services/promptStorage.test.ts` | Storage and migration tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/config.ts` | Remove `prompt` and `openrouter.model`, add `defaultModel` |
| `src/App.tsx` | Add prompt selector dropdown, load selected prompt, pass prompt/model to `generateSummary`, add `manage-prompts` page routing |
| `src/services/openrouter.ts` | Accept `promptText` and `model` as parameters instead of reading from config |
| `src/components/Settings.tsx` | Add "Manage Prompts" navigation entry below API key section |
| `tests/services/openrouter.test.ts` | Update to pass prompt/model as parameters |

---

## 16. Error Handling

| Error Condition | Where | Message |
|----------------|-------|---------|
| Prompt not found in storage | Main screen (on summarize) | Falls back to system prompt silently |
| Empty prompt name (on save) | Management screen | "Prompt name cannot be empty." |
| Missing `{{transcript}}` (on save) | Management screen | "Prompt must include {{transcript}} placeholder." |
| Cannot delete system prompt | Management screen | Error thrown (button hidden, defensive check) |
| Cannot edit system prompt name/text | Management screen | Fields disabled (defensive check) |
| Model list fetch failure | Management screen | "Failed to load models" + Retry button |
| Delete default prompt | Management screen | Auto-selects next alphabetically as new default |

---

## 17. Edge Cases

### Deleting the Default Prompt

When the current default is deleted:
1. Show confirmation dialog
2. On confirm, delete the prompt
3. Auto-select the next alphabetically sorted prompt as default
4. Update both `PROMPTS` and `DEFAULT_PROMPT_ID` in storage
5. If the deleted prompt was selected on the main screen, update `selectedPromptId` to the new default

### Deleting a Prompt Selected on Main Screen

If the user deletes a prompt that happens to be currently selected in the main screen picker (but is not the default):
1. The prompt disappears from the dropdown
2. The picker falls back to the default prompt
3. Summarization uses the default prompt

### All Custom Prompts Deleted

Built-in prompts cannot all be deleted (system prompt is protected). The system prompt ensures there is always at least one prompt available.

### First Launch (Fresh Install)

1. `getPrompts()` finds no stored prompts and version = 0
2. Migration runs: adds all 14 built-in prompts
3. Sets version to `DEFAULT_PROMPTS_VERSION`
4. Default prompt ID set to `default-quick-summary`

### App Upgrade with New Built-in Prompts

1. New app version ships with `DEFAULT_PROMPTS_VERSION` incremented
2. On first `getPrompts()` call, stored version < new version
3. Migration adds any missing built-in prompt IDs
4. User-modified built-ins are preserved (`isModified: true`)
5. Unmodified built-ins are updated to new definitions
6. Version updated

---

## 18. Test Coverage

### `promptStorage.test.ts`

**CRUD Operations:**
- Get prompts returns sorted list
- Get prompts returns empty → seeds defaults
- Add prompt with valid name/text/model
- Add prompt auto-defaults model to `openai/gpt-4o-mini`
- Update prompt name, text, model
- Update system prompt: only model allowed
- Update system prompt: name/text throws error
- Delete custom prompt
- Delete system prompt throws error
- Delete default prompt auto-selects new default
- Duplicate prompt creates "Copy of" with new ID

**Validation:**
- `validatePromptName`: empty string fails, whitespace-only fails, non-empty passes
- `validatePromptText`: missing `{{transcript}}` fails, present passes

**Migrations:**
- Fresh install seeds all 14 built-in prompts
- Upgrade adds missing built-ins without touching existing
- Modified built-ins preserved on upgrade
- Unmodified built-ins updated on upgrade
- System prompt recreated if missing
- Prompts without model field get default model

**Default Prompt:**
- `getDefaultPrompt` returns stored default
- `getDefaultPrompt` falls back to system prompt
- `setDefaultPromptId` updates flags on all prompts

**Reset:**
- `resetBuiltInPrompt` restores original text/name
- `resetBuiltInPrompt` clears `isModified` flag
- `resetBuiltInPrompt` on non-built-in throws error

### `openrouter.test.ts` (Updated)

- `generateSummary` uses passed prompt text and model (not config)
- Template replacement of `{{transcript}}` in passed prompt

### `modelService.test.ts`

- Fetches model list from OpenRouter API
- Returns cached list on subsequent calls within session
- Handles network error gracefully
- Handles non-OK HTTP response

---

## 19. Implementation Notes

### Capacitor Preferences vs chrome.storage.local

| Feature | chrome.storage.local (Extension) | Capacitor Preferences (Mobile) |
|---------|----------------------------------|-------------------------------|
| API | `chrome.storage.local.get/set` | `Preferences.get/set` |
| Data format | Native objects (auto-serialized) | Strings only (must JSON.stringify) |
| Change listeners | `chrome.storage.onChanged` | None (poll or prop-drill) |
| Sync | No | No |

Key difference: Capacitor Preferences stores strings, so all JSON must be explicitly serialized/deserialized. The extension's `chrome.storage.local` handles this transparently.

### No Storage Listeners

Unlike the extension (which uses `chrome.storage.onChanged` to sync prompt changes across tabs), the mobile app has a single webview. No cross-tab sync is needed. Prompt state is managed via React state and re-read from storage when navigating to/from screens.

### UUID Generation

Use `crypto.randomUUID()` for generating prompt IDs, same as the extension. This is available in modern WebView environments (Android 12+ / iOS 15.4+).

If targeting older devices, fall back to a simple UUID v4 implementation.
