# Magpie Mobile — Settings & API Key Management Spec

**Version:** 1.0
**Date:** 2026-02-08

---

## 1. Goal

Replace the hardcoded OpenRouter API key with a user-managed settings screen. Users enter and validate their own API key through the app. The env var fallback (`VITE_OPENROUTER_API_KEY`) is removed entirely — the only source of truth is the key stored on-device via Capacitor Preferences.

---

## 2. Scope

### In Scope

- Settings screen accessible via gear icon in the header
- API key input with masked display after saving
- Key format validation (must start with `sk-or-`)
- Key testing via `GET /api/v1/auth/key` (same as Chrome extension)
- Separate Test and Save buttons
- Persistent storage via Capacitor Preferences (SharedPreferences on Android)
- Error message on main screen links to settings when no key is configured
- Main screen state preserved across settings navigation

### Out of Scope

- Model selection, prompt customization (future settings)
- Credit balance display
- Android Keystore encryption
- Auto-retry after saving a new key
- Key removal button (overwrite with new key is sufficient)

---

## 3. Navigation

### Entry Point

Gear icon (`⚙`) in the top-right corner of the existing header bar.

```
┌─────────────────────────────────┐
│ Magpie                      ⚙  │
├─────────────────────────────────┤
```

### Navigation Pattern

Tapping the gear icon navigates to a full-screen settings page. The settings page has a back arrow (`←`) in the header to return to the main screen.

```
┌─────────────────────────────────┐
│ ← Settings                      │
├─────────────────────────────────┤
```

Implementation: Simple state-based routing (`currentPage: 'main' | 'settings'`) in `App.tsx`. No router library needed.

### State Preservation

All main screen state (URL input, summary, error messages, app state) is preserved when navigating to settings and back. The settings screen is a detour, not a reset.

---

## 4. Settings Screen

### Layout

```
┌─────────────────────────────────┐
│ ← Settings                      │
├─────────────────────────────────┤
│                                 │
│  OpenRouter API Key             │
│                                 │
│  ┌───────────────────────────┐  │
│  │ sk-or-•••••••••••••••abc  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌─────────┐  ┌─────────────┐  │
│  │  Test    │  │    Save     │  │
│  └─────────┘  └─────────────┘  │
│                                 │
│  ✓ API key is valid             │
│                                 │
│                                 │
│  Don't have a key?              │
│  Get one at openrouter.ai       │
│                                 │
└─────────────────────────────────┘
```

### Components

**API Key Input:**
- Password-type text input (dots by default)
- When the field is focused for editing, show the full text so the user can paste/edit
- When blurred and a key is saved, display masked: `sk-or-•••••••abc` (prefix + last 3 chars)
- Placeholder: `sk-or-...`

**Test Button:**
- Calls `GET /api/v1/auth/key` with the entered key
- States: default, loading (spinner), success ("Valid"), error (shows error message)
- Disabled when input is empty
- Does NOT save the key — only validates

**Save Button:**
- Saves the key to Capacitor Preferences
- Disabled when input is empty or when key has not been tested successfully
- After save, shows brief "Saved" confirmation
- Returns focus to the input in masked mode

**Status Area:**
- Below the buttons
- Shows test/save feedback:
  - Testing: spinner + "Testing..."
  - Success: green checkmark + "API key is valid"
  - Auth error (401/403): red + "Invalid API key"
  - Network error: red + "Network error. Check your connection."
  - Saved: green + "Saved"

**Help Link:**
- Below the status area
- Text: "Don't have a key? Get one at openrouter.ai"
- `openrouter.ai` is tappable, opens in system browser

### States

| State | Input | Test Button | Save Button | Status |
|-------|-------|------------|-------------|--------|
| Empty (no saved key) | Empty, editable | Disabled | Disabled | None |
| Has saved key | Masked | Disabled | Disabled | None |
| Editing | Full text visible | Enabled | Disabled | None |
| Testing | Full text visible | Disabled (spinner) | Disabled | "Testing..." |
| Test passed | Full text visible | Enabled | Enabled | "API key is valid" |
| Test failed | Full text visible | Enabled | Disabled | Error message |
| Saving | Full text visible | Disabled | Disabled (spinner) | "Saving..." |
| Saved | Masked | Disabled | Disabled | "Saved" (fades after 2s) |

---

## 5. API Key Validation

### Format Validation (Client-side)

Before making any network call, validate the key format:

```typescript
function validateApiKeyFormat(key: string): string | null {
  if (!key.startsWith('sk-or-')) {
    return 'Invalid key format. Should start with sk-or-';
  }
  return null; // valid format
}
```

Format errors are shown inline immediately when the user taps Test. No network call is made.

### Server Validation

**Endpoint:** `GET {apiUrl}/auth/key`
**Headers:**
```typescript
{
  'Authorization': `Bearer ${apiKey}`,
  'HTTP-Referer': 'https://magpie.app',
  'X-Title': 'Magpie',
}
```

**Response Handling:**

| HTTP Status | Result |
|-------------|--------|
| 2xx | `{ valid: true }` |
| 401 or 403 | `{ valid: false, error: 'Invalid API key' }` |
| Other HTTP error | `{ valid: false, error: 'API error: {status}' }` |
| Network failure | `{ valid: false, error: 'Network error. Check your connection.' }` |

### Save Behavior

- Save is blocked if the key has not passed testing
- Save is blocked if the test returned an error
- On successful save, key is written to Capacitor Preferences
- The save does NOT re-test — it relies on the prior test result

---

## 6. Storage

### Technology

Capacitor Preferences (`@capacitor/preferences`) — uses SharedPreferences on Android, UserDefaults on iOS.

### Storage Key

```typescript
const STORAGE_KEY = 'openrouter_api_key';
```

### API

```typescript
import { Preferences } from '@capacitor/preferences';

// Save
await Preferences.set({ key: STORAGE_KEY, value: apiKey });

// Load
const { value } = await Preferences.get({ key: STORAGE_KEY });

// The key is a plain string or null if not set
```

### Security

SharedPreferences stores data in the app's private sandbox. The key is only at risk if the device is rooted. This is acceptable for a user-provided key — the user is choosing to store their own credential on their own device.

---

## 7. App Startup Flow

On app mount:

1. Load API key from Capacitor Preferences
2. If key exists, store in app state and proceed normally
3. If no key, app operates in "no key" mode — Summarize button works but will show an error linking to settings

There is no forced onboarding. The user discovers they need a key when they first try to summarize.

---

## 8. Main Screen Changes

### Header

Add gear icon to the right side of the header:

```tsx
<header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
  <h1 className="text-lg font-semibold text-gray-800">Magpie</h1>
  <button onClick={navigateToSettings}>
    {/* gear icon */}
  </button>
</header>
```

### Error Message with Link

When the API key is not configured, the error message includes a tappable link:

```
API key not configured. Go to Settings to add your key.
```

"Go to Settings" navigates to the settings screen. This replaces the current static error message.

### Config Changes

Remove `import.meta.env.VITE_OPENROUTER_API_KEY` from `config.ts`. The API key is now loaded from Capacitor Preferences at runtime and passed through app state.

The `config` object becomes:

```typescript
export const config = {
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  prompt: `...`,
  maxTranscriptChars: 504000,
} as const;
```

The API key is separate — managed by app state, not a compile-time constant.

---

## 9. Files Changed

### New Files

| File | Purpose |
|------|---------|
| `src/services/storage.ts` | Capacitor Preferences wrapper for API key read/write |
| `src/services/apiKeyValidation.ts` | Format check + server validation (mirrors extension's `apiKeyValidation.ts`) |
| `src/components/Settings.tsx` | Settings screen component |
| `tests/services/apiKeyValidation.test.ts` | Tests for validation logic |
| `tests/services/storage.test.ts` | Tests for storage service |

### Modified Files

| File | Changes |
|------|---------|
| `package.json` | Add `@capacitor/preferences` dependency |
| `capacitor.config.ts` | No changes needed (Preferences works out of the box) |
| `src/config.ts` | Remove `apiKey` from config object, remove env var reference |
| `src/env.d.ts` | Remove `VITE_OPENROUTER_API_KEY` type |
| `src/App.tsx` | Add page routing state, gear icon, settings navigation, load key on mount |
| `src/services/openrouter.ts` | Accept API key as parameter instead of reading from config |
| `tests/services/openrouter.test.ts` | Update mocks to pass API key as parameter |

### Deleted Files

| File | Reason |
|------|--------|
| `.env.example` | No longer needed — no env vars for API key |

---

## 10. Error Handling

| Error Condition | Where | Message |
|----------------|-------|---------|
| No API key stored | Main screen (on summarize) | "API key not configured. [Go to Settings] to add your key." |
| Invalid key format | Settings (on test) | "Invalid key format. Should start with sk-or-" |
| Invalid key (401/403) | Settings (on test) | "Invalid API key" |
| Network error during test | Settings (on test) | "Network error. Check your connection." |
| Other API error during test | Settings (on test) | "API error: {status}" |
| Invalid key during summarize | Main screen | "Failed to generate summary. Please try again." (existing) |

---

## 11. Dependencies

### New

```
@capacitor/preferences ^6.0.0
```

### Removed

No dependencies removed, but `VITE_OPENROUTER_API_KEY` env var support is removed from the build pipeline.

---

## 12. Test Coverage

### New Tests

**`apiKeyValidation.test.ts`:**
- Format validation: accepts `sk-or-*`, rejects other prefixes, rejects empty
- Server validation: success, 401, 403, other HTTP errors, network errors
- Mocked fetch for all server tests

**`storage.test.ts`:**
- Save key, load key, load when no key saved
- Mocked Capacitor Preferences

### Updated Tests

**`openrouter.test.ts`:**
- Update `generateSummary` calls to pass API key as parameter
- Update mock to remove API key from config
