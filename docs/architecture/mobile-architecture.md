# Magpie — Mobile App Architecture

**Document Version:** 1.0
**Last Updated:** 2026-02-07

---

## 1. Overview

The Magpie mobile app (iOS & Android) provides AI-powered YouTube video summarization. Users share a YouTube link from any app, and Magpie generates a summary using the user's OpenRouter API key.

---

## 2. Technology Stack

| Category | Technology | Rationale |
|----------|------------|-----------|
| Language | TypeScript | Shared with extension |
| UI | React + Tailwind CSS | Shared with extension |
| Build | Vite | Single config (unlike extension's five) |
| Native Shell | Capacitor 6+ | Wraps web app as native iOS/Android |
| OTA Updates | `capacitor-updater` (self-hosted) | No vendor lock-in, free |
| Local Storage | Capacitor Preferences | Platform-native key-value store |

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────┐
│            Capacitor Native Shell         │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │     WebView (WKWebView / WebView)   │  │
│  │                                      │  │
│  │         React Application            │  │
│  │    (all UI and business logic)       │  │
│  │                                      │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  Plugin Bridge (JS ↔ Native)              │
│  ┌────────────┐ ┌────────┐ ┌───────────┐ │
│  │Share Target │ │Storage │ │OTA Updater│ │
│  └────────────┘ └────────┘ └───────────┘ │
└───────┬──────────────────────────┬────────┘
        │                          │
        ▼                          ▼
┌────────────────┐      ┌──────────────────┐
│ Transcript API │      │  OpenRouter API   │
│ (your backend) │      │  (direct from    │
│ URL→transcript │      │   device)        │
└────────────────┘      └──────────────────┘
```

**Capacitor Native Shell** — Thin native wrapper providing a full-screen WebView and a plugin bridge to native APIs. Users see an app, not a browser.

**React Application** — All UI and business logic runs as a standard web app inside the WebView.

**Plugin Bridge** — Connects JavaScript to native capabilities (share intent, local storage, OTA updates). Extensible with additional plugins as needed.

**Transcript API** — Backend service you control. The mobile app cannot inject into YouTube pages like the extension does, so a backend extracts transcripts on behalf of the app.

**OpenRouter API** — Called directly from the device using the user's own API key. Same streaming SSE pattern as the extension.

---

## 4. Key Architectural Decisions

### 4.1 WebView vs. Native UI

The app uses a WebView (Capacitor) rather than native components (React Native). The app's workload — receiving a URL, making API calls, and displaying markdown text — does not benefit from native rendering. The WebView approach maximizes code reuse with the extension and minimizes the learning curve.

### 4.2 No Backend for AI Calls

OpenRouter calls go directly from the device to OpenRouter's API. The user provides their own API key, stored locally. This avoids building and paying for a proxy backend. The only backend dependency is the Transcript API.

### 4.3 No User Accounts

All data is stored locally on-device using Capacitor Preferences. No authentication, no server-side user state, no sync. This keeps the architecture simple and eliminates an entire backend surface.

### 4.4 Self-Hosted OTA Updates

The `capacitor-updater` plugin runs in manual mode. A JSON manifest on your server declares the latest version and bundle URL. The app checks on launch, downloads if newer, and applies on next restart. No third-party OTA service required. Store releases are only needed when native code changes (new plugins, permissions, or Capacitor upgrades).

### 4.5 Share Intent as Primary Entry Point

The app is designed around receiving shared URLs. When a user shares a YouTube link to Magpie, the app opens and auto-summarizes using the default prompt. This is the primary — not secondary — way users interact with the app.

---

## 5. Data Flow

```
Share Sheet ─► App receives YouTube URL
                    │
                    ▼
            Transcript API
            (URL → transcript + title)
                    │
                    ▼
            OpenRouter API (SSE stream)
            (transcript + prompt → summary)
                    │
                    ▼
            Render streaming markdown
                    │
                    ▼
            Save to local history
```

---

## 6. Relationship to Extension

The mobile app and Chrome extension are independent clients sharing the same external services (OpenRouter) and architectural patterns. They do not share data or state.

### Shared Across Both
- TypeScript type definitions
- YouTube URL parsing utilities
- SSE parser logic
- Default prompt definitions
- OpenRouter API client patterns

### Replaced in Mobile
- Chrome content scripts → Transcript API (backend)
- Chrome service worker → React app handles API calls directly
- Chrome storage API → Capacitor Preferences
- Chrome side panel → Full-screen mobile UI

---

## 7. Deployment

| Target | Mechanism |
|--------|-----------|
| iOS | App Store (Xcode project generated by Capacitor) |
| Android | Google Play (Android Studio project generated by Capacitor) |
| Web updates (JS/CSS/HTML) | Self-hosted OTA via `capacitor-updater` |
| Native updates (plugins, permissions) | Store release required |

---

## 8. Future Architectural Considerations

- **Backend proxy for AI calls** — Move OpenRouter calls server-side if monetization requires controlling API costs
- **User accounts + sync** — Add authentication layer to sync history between extension and mobile app
- **Push notifications** — Background summary generation with native notifications
- **Home screen widgets** — Native widgets displaying recent summaries

---

## References

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [capacitor-updater](https://github.com/Cap-go/capacitor-updater)
- [OpenRouter API](https://openrouter.ai/docs)
- [Magpie Extension Architecture](./extension-architecture.md)
