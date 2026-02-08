# Mobile Share Intent Spec

## Overview

Enable users to share YouTube URLs from any app (YouTube, Chrome, messaging apps, etc.) into Magpie via the OS share sheet. On receiving a shared URL, the app auto-summarizes using the user's default prompt.

## Platform Scope

- **Android**: Full implementation (primary target, already set up in repo)
- **iOS**: Spec'd here; share extension passes URL to main app via custom URL scheme

## Decisions

| Decision | Choice |
|---|---|
| Auto-summarize vs. pre-fill | Auto-summarize using default prompt |
| Shared text parsing | Extract first YouTube URL from text, ignore surrounding content |
| No API key on share | Existing error flow handles it (error banner + "Go to Settings" link) |
| Share during active summary | Replace immediately, no confirmation dialog |
| Share while on Settings/Prompts screen | Always navigate to main screen |
| Deep links | Not in scope (share sheet only) |
| Share sheet visibility | Register for all `text/plain` shares (inline error if no YouTube URL found) |
| Non-YouTube share | Show inline error: "No YouTube URL found in shared content" |
| Cold start UX | Existing app load is fine, no special splash |
| iOS share extension strategy | Extension extracts URL, opens main app via URL scheme; all processing in main app |

## Plugin

**`send-intent`** (by carsten-klaffke) v6.x

- npm: `send-intent`
- GitHub: https://github.com/carsten-klaffke/send-intent
- Capacitor 6 compatible (v6.0.2)
- Supports Android `ACTION_SEND` and iOS Share Extension
- Simple API: `SendIntent.checkSendIntentReceived()` returns `{ url?, title?, type? }`

## Android Implementation

### 1. AndroidManifest.xml

Add a `SEND` intent filter to the existing `<activity>` block (which already has `launchMode="singleTask"`):

```xml
<intent-filter>
  <action android:name="android.intent.action.SEND" />
  <category android:name="android.intent.category.DEFAULT" />
  <data android:mimeType="text/plain" />
</intent-filter>
```

This goes alongside the existing `MAIN`/`LAUNCHER` intent filter, not replacing it.

### 2. Plugin Installation

```bash
npm install send-intent
npx cap sync
```

The plugin registers itself automatically via Capacitor's plugin autoloading.

### 3. Intent Flow (Android)

1. User taps Share in YouTube/Chrome/etc. and picks Magpie
2. Android launches Magpie (or brings existing instance to front, since `singleTask`)
3. `send-intent` plugin captures the intent data
4. On app init (or resume), React calls `SendIntent.checkSendIntentReceived()`
5. Returns `{ url: "https://youtu.be/VIDEO_ID" }` (or `{ title: "Video Title", url: "https://..." }`)
6. App extracts YouTube URL, navigates to main, auto-summarizes

## iOS Implementation

### 1. Share Extension Target

Create an iOS Share Extension in Xcode that:

- Accepts `text/plain` content via `NSExtensionActivationSupportsText`
- Extracts the shared text
- Opens the main Magpie app via custom URL scheme: `magpie://share?url=<encoded-youtube-url>`
- Dismisses itself

### 2. Custom URL Scheme

Register `magpie://` URL scheme in the iOS app's `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>magpie</string>
    </array>
  </dict>
</array>
```

### 3. Intent Flow (iOS)

1. User taps Share in YouTube/Safari/etc. and picks Magpie
2. iOS share extension receives the text
3. Extension extracts YouTube URL from shared text
4. Extension opens `magpie://share?url=<encoded-url>`
5. Main app receives URL via `SendIntent.checkSendIntentReceived()` (or `@capacitor/app` `appUrlOpen` listener)
6. App navigates to main, auto-summarizes

### 4. iOS Constraints

- Share extensions have ~120MB RAM and ~30 second time limits
- No summarization logic runs in the extension; it only extracts and forwards the URL
- The `send-intent` plugin handles the iOS Share Extension setup scaffolding

## React Changes (src/App.tsx)

### New Service: `src/services/shareIntent.ts`

```typescript
import { SendIntent } from 'send-intent';

export async function checkShareIntent(): Promise<string | null> {
  try {
    const result = await SendIntent.checkSendIntentReceived();
    if (result?.url) {
      return extractYouTubeUrlFromText(result.url);
    }
    return null;
  } catch {
    return null;
  }
}
```

The `extractYouTubeUrlFromText` function scans arbitrary text for the first YouTube URL match using a regex pattern covering `youtube.com/watch?v=`, `youtu.be/`, and `m.youtube.com/watch?v=` formats.

### App.tsx Integration

On app mount (and on resume from background), check for a share intent:

```
useEffect → checkShareIntent()
  ├── if URL found:
  │   ├── setCurrentPage('main')
  │   ├── setUrl(youtubeUrl)
  │   └── trigger handleSummarize()
  └── if no URL: do nothing
```

Also listen for the `resume` event (when app comes to foreground with a new intent while already running):

```typescript
import { App as CapApp } from '@capacitor/app';

CapApp.addListener('resume', async () => {
  const url = await checkShareIntent();
  if (url) {
    // navigate to main + auto-summarize
  }
});
```

### State Reset on Share

When a share intent arrives (regardless of current app state):

1. Set `currentPage` to `'main'`
2. Set `url` to the extracted YouTube URL
3. Reset `state` to `'idle'`, clear `summary` and `errorMessage`
4. Call `handleSummarize()`

This handles the "replace immediately" behavior, even if a summary is in progress or the user is on Settings/Manage Prompts.

### Non-YouTube URL Error

If `extractYouTubeUrlFromText` returns `null` (no YouTube URL found in shared text):

- Navigate to main screen
- Set error: `"No YouTube URL found in shared content"`
- Leave URL field empty

## URL Extraction Logic

Add to `src/utils/youtube.ts`:

```typescript
export function extractYouTubeUrl(text: string): string | null
```

Scans the input text for the first occurrence of a YouTube URL matching any of:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- Same patterns with `http://`

Returns the matched URL string, or `null` if no match found. This is different from the existing `extractVideoId` (which assumes the entire input is a URL) — this function finds a URL embedded in arbitrary text like `"Check this out: https://youtu.be/abc123 it's great"`.

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `send-intent` dependency |
| `android/.../AndroidManifest.xml` | Add `SEND` intent filter |
| `src/services/shareIntent.ts` | **New** — `checkShareIntent()` wrapper |
| `src/utils/youtube.ts` | Add `extractYouTubeUrl()` for text scanning |
| `src/App.tsx` | Check share intent on mount + resume, auto-summarize |
| `tests/utils/youtube.test.ts` | Tests for `extractYouTubeUrl` |
| `tests/services/shareIntent.test.ts` | **New** — tests for share intent handling |
| iOS native files (future) | Share extension target, URL scheme registration |

## Test Cases

### `extractYouTubeUrl`

- Extracts URL from plain YouTube URL string
- Extracts URL from `"Title\nhttps://youtu.be/abc123"` format
- Extracts URL from `"Check this out https://www.youtube.com/watch?v=abc123 it's great"`
- Returns `null` for text with no YouTube URL
- Returns `null` for empty string
- Handles `youtu.be`, `youtube.com`, `m.youtube.com` variants
- Returns first URL when multiple YouTube URLs present

### `checkShareIntent`

- Returns YouTube URL when intent contains valid URL
- Returns `null` when intent has no URL
- Returns `null` when plugin throws (e.g., web environment)
- Extracts URL from intent text containing extra content

### App integration (manual testing)

- Share from YouTube app → auto-summarizes
- Share from Chrome (URL + title text) → extracts URL, auto-summarizes
- Share non-YouTube text → inline error message
- Share while on Settings screen → navigates to main, summarizes
- Share while summary in progress → replaces with new URL
- Share with no API key set → error with "Go to Settings" link
- Cold start via share → app loads, then auto-summarizes
- Warm resume via share → new URL replaces current state

## Out of Scope

- Deep links / `ACTION_VIEW` for YouTube URLs
- Share history / queue of shared URLs
- Sharing summaries back out from Magpie
- iOS implementation (spec'd above, built in a follow-up)
