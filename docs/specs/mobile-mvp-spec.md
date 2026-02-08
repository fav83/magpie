# Magpie Mobile MVP — Product Spec

**Version:** 1.0
**Date:** 2026-02-08

---

## 1. Goal

Build a minimal viable mobile app that lets a user paste a YouTube video URL and receive an AI-generated summary. The app targets Android first, with iOS to follow. All configuration (API key, model, prompt) is hardcoded for the MVP.

---

## 2. Scope

### In Scope (MVP)

- Single-screen app: URL input + summarize button + summary display
- Transcript extraction in-app via InnerTube ANDROID client API (no backend dependency)
- OpenRouter API call with hardcoded API key, model, and prompt
- Client-side YouTube URL validation before any API calls
- Two-phase loading feedback: "Fetching transcript..." then "Generating summary..."
- Markdown rendering of summary output (react-markdown)
- Disable button during generation (no concurrent requests)
- Error handling: invalid URL, no captions, transcript too long, API errors
- Match extension visual style (colors, Tailwind patterns)
- Use existing Magpie branding (app name + icon assets from extension)
- Android-first development, tested on physical device + emulator

### Out of Scope (Post-MVP)

- Share intent (receive URLs from YouTube app / share sheet)
- Streaming token-by-token display
- Local history / persistence (summaries are ephemeral)
- User-configurable API key, model, or prompt selection
- Copy to clipboard button
- iOS build and testing
- OTA updates (`capacitor-updater`)
- Chat / follow-up questions
- User accounts or sync

---

## 3. Technology Stack

| Category | Technology | Rationale |
|----------|------------|-----------|
| Language | TypeScript | Shared with extension |
| UI | React 18 + Tailwind CSS | Shared with extension |
| Build | Vite | Single config (unlike extension's five) |
| Native Shell | Capacitor 6+ | Wraps web app as native iOS/Android |
| Transcript | Custom InnerTube ANDROID client API | Direct HTTP calls to YouTube's InnerTube API with ANDROID client context; returns caption URLs without PoToken requirements |
| HTTP/CORS | CapacitorHttp (global patch) | Routes all fetch calls through native layer, bypassing CORS transparently |
| Markdown | react-markdown | Same library as extension |
| Local Storage | None (MVP is ephemeral) | No Capacitor Preferences needed yet |

---

## 4. Architecture

```
┌──────────────────────────────────────────┐
│            Capacitor Native Shell        │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │    WebView (WKWebView / WebView)   │  │
│  │                                    │  │
│  │        React Application           │  │
│  │   ┌──────────┐  ┌──────────────┐  │  │
│  │   │ URL Input │  │ Summary View │  │  │
│  │   └──────────┘  └──────────────┘  │  │
│  │                                    │  │
│  │   ┌──────────────────────────────┐│  │
│  │   │     App Logic (React)        ││  │
│  │   │  - URL validation            ││  │
│  │   │  - InnerTube transcript       ││  │
│  │   │  - OpenRouter API call       ││  │
│  │   │  - State management          ││  │
│  │   └──────────────────────────────┘│  │
│  └────────────────────────────────────┘  │
│                                          │
│  CapacitorHttp (global fetch patch)      │
└──────────┬───────────────────┬───────────┘
           │                   │
           ▼                   ▼
   ┌──────────────┐   ┌──────────────────┐
   │  YouTube     │   │  OpenRouter API   │
   │  InnerTube   │   │  (gpt-4o-mini)   │
   │  API         │   │                  │
   └──────────────┘   └──────────────────┘
```

**Key difference from architecture doc:** No Transcript API backend. The app extracts transcripts directly via custom HTTP calls to YouTube's InnerTube API with ANDROID client context. Capacitor's global CapacitorHttp patch routes these requests through the native HTTP layer, bypassing CORS.

---

## 5. Data Flow

```
User pastes YouTube URL
        │
        ▼
Client-side URL validation
(must match youtube.com/watch?v=)
        │
        ├── Invalid → Show "Please enter a valid YouTube URL"
        │
        ▼ Valid
Button disabled, show "Fetching transcript..."
        │
        ▼
Custom InnerTube API call extracts transcript (ANDROID client context)
(fetch routed through CapacitorHttp → native layer → no CORS)
        │
        ├── No captions → Show "No transcript available for this video"
        ├── Error → Show error message
        │
        ▼ Success
Check transcript length vs model context window (128K tokens)
        │
        ├── Too long → Show "This video is too long for the current model"
        │
        ▼ Fits
Show "Generating summary..."
        │
        ▼
POST to OpenRouter API (non-streaming)
  - Model: openai/gpt-4o-mini
  - Prompt: Quick Summary + transcript
  - API key: hardcoded
        │
        ├── Error → Show API error message
        │
        ▼ Success
Render summary as markdown
Re-enable button
```

---

## 6. Hardcoded Configuration

### OpenRouter API Key

```typescript
const OPENROUTER_API_KEY = 'sk-or-...'; // Hardcoded for MVP
```

**Security note:** This key is extractable from the APK. Acceptable for MVP — will be replaced with user-provided key input post-MVP. Use a key with low spend limits.

### Model

```typescript
const MODEL_ID = 'openai/gpt-4o-mini';
```

Context window: 128,000 tokens. Fast, cheap, good quality for summaries.

### Prompt

The extension's "Quick Summary" prompt:

```
Summarize in 3-5 short bullet points:
• What's the main topic?
• What are the key points?
• What's the takeaway?

One sentence per bullet. No preamble or introduction - start directly with the bullets.

{{transcript}}
```

The `{{transcript}}` placeholder is replaced with the extracted transcript text at runtime.

---

## 7. UI Specification

### Layout

Single screen with three zones:

```
┌─────────────────────────────┐
│         App Header          │
│         "Magpie"            │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │  Paste YouTube URL    │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │     Summarize         │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│                             │
│  Summary / Status Area      │
│  (scrollable)               │
│                             │
│  - Loading states           │
│  - Error messages           │
│  - Rendered markdown        │
│                             │
│                             │
│                             │
└─────────────────────────────┘
```

### States

| State | Display |
|-------|---------|
| **Empty** | URL input + enabled button. No content below. |
| **Fetching transcript** | Input + disabled (grayed) button. Status area shows spinner + "Fetching transcript..." |
| **Generating summary** | Input + disabled button. Status area shows spinner + "Generating summary..." |
| **Summary ready** | Input + enabled button. Status area shows rendered markdown summary. |
| **Error** | Input + enabled button. Status area shows error message. |

### Behavior

- **New URL replaces previous summary.** When the user modifies the URL and taps Summarize again, the previous summary is cleared and replaced.
- **Button is disabled** during the entire fetch-transcript + generate-summary pipeline. Re-enables on success or error.
- **URL input** is a standard text field. No special paste detection — user taps the field, pastes, taps Summarize.

### Visual Style

Match the extension's color scheme and Tailwind utility patterns. The extension uses:
- Default Tailwind config (no custom theme extensions)
- Standard Tailwind utility classes
- No component library — all custom components

The mobile app should feel like the same product on a different form factor.

### Branding

- **App name:** Magpie
- **Icons:** Reuse existing assets from `extension/public/icons/` (icon.svg, icon-128.png, etc.)
- Generate required Android adaptive icon sizes from the SVG source

---

## 8. Error Handling

| Error Condition | Message | Recovery |
|----------------|---------|----------|
| Invalid URL (client-side) | "Please enter a valid YouTube video URL" | User corrects URL and retries |
| No captions available | "No transcript available for this video" | User tries a different video |
| Transcript too long | "This video is too long for the current model. Try a shorter video." | User tries shorter video |
| YouTube extraction failed | "Failed to extract transcript. Please try again." | User retries |
| OpenRouter API error | "Failed to generate summary. Please try again." | User retries |
| Network error | "No internet connection. Please check your network." | User fixes network and retries |

All errors re-enable the Summarize button so the user can retry.

---

## 9. Project Structure

Monorepo layout — new `mobile/` directory alongside existing folders:

```
magpie/
├── extension/          # Chrome extension (existing)
├── landing/            # Marketing website (existing)
├── mobile/             # Mobile app (NEW)
│   ├── src/
│   │   ├── App.tsx             # Root component
│   │   ├── App.css             # Global styles (Tailwind imports)
│   │   ├── main.tsx            # React entry point
│   │   ├── config.ts           # Hardcoded API key, model, prompt
│   │   ├── components/
│   │   │   ├── UrlInput.tsx    # URL text field
│   │   │   ├── SummarizeButton.tsx
│   │   │   ├── SummaryView.tsx # Markdown renderer
│   │   │   ├── LoadingState.tsx
│   │   │   └── ErrorMessage.tsx
│   │   ├── services/
│   │   │   ├── transcript.ts   # InnerTube API transcript extraction
│   │   │   └── openrouter.ts   # OpenRouter API client (non-streaming)
│   │   └── utils/
│   │       └── youtube.ts      # URL validation + video ID extraction
│   ├── public/
│   │   └── index.html
│   ├── android/                # Capacitor Android project (generated)
│   ├── ios/                    # Capacitor iOS project (generated, later)
│   ├── capacitor.config.ts     # Capacitor configuration
│   ├── vite.config.ts          # Single Vite config
│   ├── tailwind.config.js      # Tailwind config (matching extension)
│   ├── tsconfig.json           # TypeScript strict config
│   └── package.json            # Dependencies
├── docs/
│   ├── architecture/
│   └── specs/
│       └── mobile-mvp-spec.md  # This document
└── CLAUDE.md
```

### Shared Code Strategy

For the MVP, **copy utilities rather than creating a shared package.** The shared surface is small:

| Utility | Extension Source | Mobile Equivalent |
|---------|----------------|-------------------|
| URL validation | `extension/src/utils/youtube.ts` | `mobile/src/utils/youtube.ts` (copy) |
| Prompt text | `extension/src/data/defaultPrompts.json` | Hardcoded in `mobile/src/config.ts` |
| OpenRouter API | `extension/src/service-worker/openrouterApi.ts` | `mobile/src/services/openrouter.ts` (simplified, non-streaming) |

Post-MVP, if sharing grows, extract a `shared/` package.

---

## 10. Capacitor Configuration

```typescript
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.magpie.app',
  appName: 'Magpie',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true, // Global fetch patch — bypasses CORS for all requests
    },
  },
};

export default config;
```

---

## 11. Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^10.1.0",
    "@capacitor/core": "^6.0.0",
    "@capacitor/android": "^6.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "latest",
    "tailwindcss": "^3.4.0",
    "postcss": "latest",
    "autoprefixer": "latest",
    "@capacitor/cli": "^6.0.0"
  }
}
```

---

## 12. YouTube URL Validation

Reuse the extension's validation pattern. Accept URLs matching:

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtube.com/watch?v=VIDEO_ID`
- `https://m.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID` (short URLs)

Reject everything else with: "Please enter a valid YouTube video URL"

Video ID extraction:
```typescript
function extractVideoId(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1);
    }
    return new URLSearchParams(parsed.search).get('v') ?? '';
  } catch {
    return '';
  }
}
```

---

## 13. Context Length Validation

Before sending to OpenRouter, estimate token count:

- **Rough estimate:** 1 token ~= 4 characters
- **gpt-4o-mini context:** 128,000 tokens
- **Reserve for prompt + response:** ~2,000 tokens
- **Max transcript characters:** ~504,000

If the transcript exceeds this limit, show: "This video is too long for the current model. Try a shorter video."

---

## 14. Development Workflow

### Initial Setup

```bash
cd magpie/mobile
npm install
npx cap init Magpie com.magpie.app
npm run build
npx cap add android
npx cap sync
```

### Development Loop

```bash
npm run dev          # Vite dev server (browser testing)
npm run build        # Production build
npx cap sync         # Copy web assets to Android project
npx cap open android # Open in Android Studio
                     # Run on device/emulator from Android Studio
```

### Testing Strategy

1. **Browser first** — Develop and test UI in Chrome (transcript extraction won't work due to CORS, but UI layout/states can be verified)
2. **Android emulator** — Test full flow including transcript extraction and API calls
3. **Physical Android device** — Validate real-world performance and WebView behavior

---

## 15. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| YouTube InnerTube API changes | Transcript extraction breaks | Custom implementation mirrors proven approach from `youtube-transcript-api` (Python); monitor for API changes |
| Hardcoded API key extracted from APK | Unauthorized API usage, cost | Use low-limit key; replace with user-provided key in next iteration |
| YouTube rate limits mobile device IPs | Extraction fails intermittently | Show retry-friendly error; consider caching transcripts in future |

---

## 16. Post-MVP Roadmap (Ordered Priority)

1. **User-provided OpenRouter API key** — Remove hardcoded key, add settings screen
2. **Share intent** — Receive YouTube URLs from share sheet (primary mobile UX)
3. **Streaming summary display** — Token-by-token rendering with auto-scroll
4. **Local history** — Persist summaries via Capacitor Preferences
5. **Copy to clipboard** — One-tap copy of summary text
6. **iOS build** — Add iOS platform, test on device
7. **Prompt and model selection** — Let user choose from built-in prompts and models
8. **OTA updates** — Self-hosted `capacitor-updater` for web layer updates
9. **Chat** — Follow-up questions about video content
