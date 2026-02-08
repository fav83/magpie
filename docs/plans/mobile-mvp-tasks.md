# Magpie Mobile MVP — Task Breakdown

**Source:** `docs/specs/mobile-mvp-spec.md`
**Date:** 2026-02-08

---

> **Note:** The MVP spec intentionally departs from `docs/architecture/mobile-architecture.md` in several areas (no backend for transcripts, no share intent, no streaming, hardcoded API key). Follow the spec, not the architecture doc, for MVP decisions.

---

## Task 1: Project scaffolding and Android app shell

**Deliverable:** Magpie-branded app opens on an Android emulator showing the UI shell — header, URL text input, Summarize button, empty content area. Full build toolchain working.

**Why separate PR:** All build tooling, native project generation, and config must exist before any feature code can be written or tested on-device. This is pure infrastructure with zero feature logic.

### What ships

**Build tooling:**
- `mobile/package.json` — all dependencies: React 18, react-dom, Tailwind CSS 3.4, Vite 6, Capacitor 6+, `react-markdown`, TypeScript 5.6+, PostCSS, autoprefixer, `@vitejs/plugin-react`, `@capacitor/cli`
- `mobile/vite.config.ts` — single Vite config with React plugin
- `mobile/tsconfig.json` — strict TypeScript (match extension's strictness settings)
- `mobile/tailwind.config.js` — matching extension's default Tailwind config
- `mobile/postcss.config.js` — PostCSS with Tailwind and autoprefixer plugins
- `mobile/.gitignore` — `node_modules/`, `dist/`, Android build outputs
- npm scripts: `dev`, `build`, `cap:sync`, `cap:open`

**Capacitor config:**
- `mobile/capacitor.config.ts` — appId `com.magpie.app`, appName `Magpie`, webDir `dist`, `CapacitorHttp.enabled: true`
- Include `server.url` pointing to Vite dev server (e.g., `http://10.0.2.2:5173` for emulator) behind a dev-mode flag or comment, so live reload works during development without requiring `build + sync` on every change
- `mobile/android/` — generated Capacitor Android project

**UI shell (static, non-functional):**
- `mobile/public/index.html` — entry HTML with viewport meta for mobile
- `mobile/src/main.tsx` — React root mount
- `mobile/src/App.tsx` — static layout: Magpie header, URL text input field, Summarize button, empty scrollable content area. Styled with Tailwind to match extension's visual patterns. Button does nothing.
- `mobile/src/App.css` — Tailwind directives (`@tailwind base/components/utilities`)

**Branding:**
- Android app icon generated from `extension/public/icons/icon.svg` using Android Studio's Image Asset Studio to create `ic_launcher` adaptive icon assets in all `mipmap-*` directories
- App name "Magpie" configured in Capacitor and Android manifest

**Monorepo note:** `mobile/` is a fully independent project (own `package.json`, own `node_modules`). No workspace configuration at the root level.

### What does NOT ship

- No feature logic (button does nothing)
- No services, no API calls, no URL validation

### Acceptance criteria

1. `npm run build` in `mobile/` produces a working `dist/` bundle
2. `npx cap sync && npx cap open android` opens the project in Android Studio
3. App runs on Android emulator showing the Magpie-branded UI shell (header, input, button, empty content area)
4. Tailwind utility classes render correctly in the Android WebView
5. Vite dev server with live reload works (code change reflects in emulator without manual rebuild)

---

## Task 2: YouTube summarization — paste URL, get summary

**Deliverable:** User pastes a YouTube video URL, taps Summarize, sees "Fetching transcript..." then "Generating summary...", and receives a markdown-rendered bullet-point summary. Errors display inline. This completes the MVP.

**Why separate PR:** This is all application logic — services, state management, UI behavior, error handling. Depends on Task 1's scaffolding.

**Prerequisite:** A working OpenRouter API key with spend limits configured. The key will be hardcoded in source.

### Implementation order (critical)

**Build and test the transcript service FIRST.** Verify the custom InnerTube API transcript extraction works through `CapacitorHttp` on a real Android emulator before building the OpenRouter service or any UI components.

**Implementation note:** The transcript service uses direct HTTP calls to YouTube's InnerTube API with ANDROID client context (reverse-engineered from Python's `youtube-transcript-api`). This approach returns caption URLs without PoToken requirements, avoiding the issues encountered with `youtubei.js`.

### What ships

**Config** (`src/config.ts`):
- Hardcoded OpenRouter API key, model ID (`openai/gpt-4o-mini`), Quick Summary prompt text
- Context length limit: 128K tokens, ~504K chars max transcript
- **Git hygiene:** Use a `config.local.ts` pattern (gitignored) or Vite env vars (`VITE_OPENROUTER_API_KEY` in a `.env.local` file, gitignored) so the live API key is never committed to git. Ship a `config.ts.example` or `.env.example` showing the required shape.

**URL validation** (`src/utils/youtube.ts`):
- `extractVideoId(url)` — extract 11-char video ID from YouTube URLs
- `isValidYouTubeUrl(url)` — boolean check
- **Important:** The extension's `extractVideoId()` only handles `?v=` query params. The mobile version must also handle `youtu.be` short URLs (pathname extraction) and `m.youtube.com`. This is new code, not a direct copy.

**Transcript service** (`src/services/transcript.ts`):
- Custom InnerTube API integration:
  1. Fetch YouTube watch page HTML, handle GDPR consent
  2. Extract `INNERTUBE_API_KEY` from page HTML
  3. POST to InnerTube player API with ANDROID client context
  4. Select best caption track (English manual > English ASR > first available)
  5. Fetch caption XML and parse into timestamped lines
- Handle errors: no captions, extraction failure, network errors
- Return structured result: `{ transcript: string; title: string }` or error

**OpenRouter service** (`src/services/openrouter.ts`):
- Non-streaming POST to `https://openrouter.ai/api/v1/chat/completions`
- Replace `{{transcript}}` placeholder in prompt with actual transcript text
- Set `HTTP-Referer` header to `https://magpie.app` (not `chrome.runtime.getURL` which doesn't exist in Capacitor)
- Parse response, extract `choices[0].message.content`
- Handle API errors: invalid key, rate limit, model errors, network failures

**Context length check:**
- Before calling OpenRouter, estimate tokens (~chars / 4)
- If transcript exceeds 128K tokens minus ~2K reserve for prompt + response, show error instead of making the call

**UI wiring in App.tsx:**

State machine: `idle` | `fetching-transcript` | `generating-summary` | `done` | `error`

On Summarize tap:
1. Validate URL → if invalid, show error inline, stay in `idle`
2. Clear previous summary, set `fetching-transcript`
3. Extract transcript via transcript service
4. If success, set `generating-summary`
5. Call OpenRouter with transcript + prompt
6. If success, set `done`, render markdown
7. On error at any stage, set `error` with message

Button disabled during states `fetching-transcript` and `generating-summary`. Re-enabled on `done` or `error`.

New URL submission clears previous summary and restarts the flow.

**UI components** (component boundaries are suggested — inline into `App.tsx` if a component is trivially small, under ~10 lines):
- `UrlInput.tsx` — text field with placeholder "Paste YouTube URL"
- `SummarizeButton.tsx` — disabled/loading state with spinner
- `LoadingState.tsx` — spinner + phase text ("Fetching transcript..." / "Generating summary...")
- `ErrorMessage.tsx` — inline error display with message text
- `SummaryView.tsx` — `react-markdown` renderer for the summary output

**Error handling** (all errors re-enable button):

| Condition | Message |
|-----------|---------|
| Invalid URL | "Please enter a valid YouTube video URL" |
| No captions | "No transcript available for this video" |
| Transcript too long | "This video is too long for the current model. Try a shorter video." |
| Extraction failed | "Failed to extract transcript. Please try again." |
| API error | "Failed to generate summary. Please try again." |
| Network error | "No internet connection. Please check your network." |

### Acceptance criteria

1. Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → receive a 3-5 bullet markdown summary
2. Paste `https://youtu.be/dQw4w9WgXcQ` → same result (short URL support)
3. Paste `https://m.youtube.com/watch?v=dQw4w9WgXcQ` → same result (mobile URL)
4. Paste `https://example.com` → inline error "Please enter a valid YouTube video URL"
5. Paste URL for a video with no captions → "No transcript available" error
6. Button is disabled with loading text during the entire pipeline
7. Loading text transitions from "Fetching transcript..." to "Generating summary..."
8. Summary renders as formatted markdown (bold text, bullet points)
9. Pasting a new URL and tapping Summarize replaces the previous summary
10. Full flow works end-to-end on Android emulator and physical device

---

## Sprint Plan

| Order | Task | Depends On |
|-------|------|------------|
| 1 | Project scaffolding and Android app shell | — |
| 2 | YouTube summarization feature | Task 1 |

**Total:** 2 tasks, 2 PRs, linear dependency. Task 1 is pure setup. Task 2 is the entire feature. MVP is complete after Task 2.
