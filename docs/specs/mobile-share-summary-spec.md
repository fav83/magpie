# Mobile Share Summary Spec

## Overview

Enable users to share a generated summary (and copy it to clipboard) from Magpie to other apps via the OS share sheet. A floating action button with a speed dial provides both actions when a summary is available.

## Platform Scope

- **Android**: Full implementation (primary target)
- **iOS**: Same UI code; plugin handles platform differences

## Decisions

| Decision | Choice |
|---|---|
| Share text format | Video title + raw Markdown summary + YouTube URL |
| Markdown handling | Share as raw Markdown (not stripped to plain text) |
| Share plugin | `@capacitor/share` (official Capacitor plugin) |
| Share API fields | Structured: title, text, and url as separate fields |
| Copy format | Same concatenated string as share (title + summary + URL) |
| UI placement | Floating action button (FAB) with speed dial in bottom-right corner |
| FAB icon | Share icon (branching arrow) when collapsed |
| Speed dial backdrop | Semi-transparent dark overlay (tap to dismiss) |
| Speed dial auto-close | Closes after tapping Share or Copy |
| Copy feedback | Button icon morphs to checkmark for 2 seconds (no toast) |
| FAB visibility | Only appears after summary is fully generated |
| FAB disappears | Immediately when a new summarization starts |
| Share/copy errors | Always silent (no error toasts or messages) |
| Summary area styling | No changes to existing layout |
| Animation approach | CSS transitions only (no additional libraries) |
| Video title in state | Bundle title with summary in a result object |

## Plugin

**`@capacitor/share`** (official Capacitor plugin)

- npm: `@capacitor/share`
- Capacitor 6 compatible
- API: `Share.share({ title, text, url, dialogTitle })` opens native share sheet
- Returns a promise; user cancellation is not an error (plugin resolves normally)

## Share Text Format

The shared content uses the `@capacitor/share` structured fields:

```
title: "Video Title"
text:  "<markdown summary>"
url:   "https://www.youtube.com/watch?v=VIDEO_ID"
```

For clipboard copy, these are concatenated into a single string:

```
Video Title

<markdown summary>

https://www.youtube.com/watch?v=VIDEO_ID
```

## State Changes

### New State: SummaryResult

Currently the App component stores the summary as a plain string (`summary: string`). This changes to a result object that bundles all data needed for sharing:

```typescript
interface SummaryResult {
  summary: string;
  title: string;
  url: string;
}
```

Replace in App.tsx:
- `const [summary, setSummary] = useState('')` → `const [summaryResult, setSummaryResult] = useState<SummaryResult | null>(null)`
- Condition `state === 'done' && summary` → `state === 'done' && summaryResult`
- `SummaryView` receives `summaryResult.summary` for rendering
- `setSummary('')` (in reset) → `setSummaryResult(null)`

The `handleSummarize` function already has access to the video title (from `transcriptResult.data.title`) and URL. These are bundled into the result object when the summary completes.

### Speed Dial State

```typescript
const [fabOpen, setFabOpen] = useState(false);
const [copySuccess, setCopySuccess] = useState(false);
```

- `fabOpen`: Whether the speed dial is expanded
- `copySuccess`: Whether to show the checkmark icon (true for 2 seconds after copy)

The speed dial resets (`fabOpen = false`) when:
- User taps Share or Copy
- User taps the backdrop
- User taps the FAB while open
- A new summarization starts (summary cleared)

## UI Components

### SpeedDialFAB

A new component rendered inside App.tsx's main page, positioned with `fixed` CSS.

**Structure when collapsed:**
```
[Share icon button] — bottom-right corner, circular, blue
```

**Structure when expanded:**
```
[Backdrop — semi-transparent overlay, full screen]
  [Copy button — smaller circle with label, above Share button]
  [Share button — smaller circle with label, above FAB]
  [FAB — now shows X close icon]
```

### Visual Specs

**Main FAB (collapsed):**
- Position: `fixed bottom-6 right-4`
- Size: 56px circle (`h-14 w-14`)
- Color: `bg-blue-600`, white icon
- Shadow: `shadow-lg`
- Icon: Share (branching arrow SVG)
- Entrance animation: Scale up from 0 with CSS transition when `state === 'done'`

**Main FAB (expanded):**
- Icon changes to X (close)
- Color stays `bg-blue-600`

**Speed dial items (expanded):**
- Two smaller circles (40px / `h-10 w-10`) stacked above the FAB
- Each has a text label to its left
- Bottom item: **Share** (share icon)
- Top item: **Copy** (clipboard icon, or checkmark after copy)
- Items animate in: translate-y + opacity + scale transition, staggered
- Color: `bg-white` with `text-gray-700`, `shadow-md`

**Backdrop:**
- `fixed inset-0 bg-black/40`
- Fade in/out with CSS opacity transition
- Tap anywhere on backdrop closes speed dial

**Copy success state:**
- Copy button icon changes from clipboard to checkmark
- Reverts after 2 seconds via `setTimeout`

### Entrance/Exit Animations (CSS only)

All animations use Tailwind's `transition` utilities:

```
FAB entrance (summary complete):
  transform: scale(0) → scale(1)
  transition: transform 200ms ease-out

Speed dial open:
  Backdrop: opacity 0 → 0.4, transition 150ms
  Items: translate-y(16px) + opacity(0) + scale(0.8)
       → translate-y(0) + opacity(1) + scale(1)
       transition 200ms ease-out
       Copy item: delay 50ms (stagger)

Speed dial close:
  Reverse of open, 150ms
```

## Implementation

### 1. Install Plugin

```bash
npm install @capacitor/share
npx cap sync
```

### 2. New Service: `src/services/shareSummary.ts`

```typescript
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';

export interface ShareContent {
  title: string;
  summary: string;
  url: string;
}

export function formatShareText(content: ShareContent): string {
  return `${content.title}\n\n${content.summary}\n\n${content.url}`;
}

export async function shareSummary(content: ShareContent): Promise<void> {
  try {
    await Share.share({
      title: content.title,
      text: content.summary,
      url: content.url,
      dialogTitle: 'Share Summary',
    });
  } catch {
    // Silent — user cancel or plugin failure
  }
}

export async function copySummary(content: ShareContent): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatShareText(content));
    return true;
  } catch {
    return false;
  }
}
```

### 3. New Component: `src/components/SpeedDialFAB.tsx`

Props:
```typescript
interface SpeedDialFABProps {
  visible: boolean;
  onShare: () => void;
  onCopy: () => void;
}
```

The component manages its own `fabOpen` and `copySuccess` internal state. The parent passes `visible` (true when `state === 'done'`) and the action handlers.

### 4. App.tsx Changes

- Add `SummaryResult` interface and replace `summary` state
- Store `title` from `transcriptResult.data.title` and `url` in result
- Render `SpeedDialFAB` with `visible={state === 'done' && summaryResult !== null}`
- Wire `onShare` to call `shareSummary(summaryResult)`
- Wire `onCopy` to call `copySummary(summaryResult)`
- Clear `summaryResult` in `resetMainScreen` and at start of `handleSummarize`

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `@capacitor/share` dependency |
| `src/services/shareSummary.ts` | **New** — `shareSummary()`, `copySummary()`, `formatShareText()` |
| `src/components/SpeedDialFAB.tsx` | **New** — FAB with speed dial, backdrop, animations |
| `src/App.tsx` | Replace `summary` string with `SummaryResult` object, render `SpeedDialFAB`, wire actions |

## Test Cases

### `formatShareText`

- Formats title + summary + URL with double newline separators
- Handles empty title gracefully
- Preserves Markdown formatting in summary

### `shareSummary`

- Calls `Share.share()` with structured title, text, url fields
- Does not throw when `Share.share()` rejects (user cancel)
- Does not throw when plugin is unavailable

### `copySummary`

- Calls `navigator.clipboard.writeText()` with formatted text
- Returns `true` on success
- Returns `false` when clipboard API throws

### App integration (manual testing)

- Summary complete → FAB appears with scale-up animation
- Tap FAB → speed dial opens with backdrop and two action buttons
- Tap Share → native share sheet opens with title, summary, URL
- Tap Copy → clipboard contains formatted text, icon shows checkmark for 2s
- Tap backdrop → speed dial closes
- Tap FAB while open → speed dial closes
- Start new summarization while FAB visible → FAB disappears immediately
- Share from external app (share intent) while FAB visible → FAB disappears, new summary starts
- Cancel share sheet → no error shown, speed dial closed

## Out of Scope

- Sharing as rich text / HTML
- Share as image / screenshot of summary
- Share individual sections of the summary
- History of shared summaries
- Platform-specific share targets (e.g., direct-to-WhatsApp)
- Haptic feedback on copy
