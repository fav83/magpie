# Magpie - YouTube Summarizer

> **Note:** This project is an experiment in vibe coding. 100% of the code was written by [Claude Code](https://claude.ai/code) and [OpenAI Codex](https://openai.com/index/openai-codex/).

A Chrome extension that uses AI to generate summaries of YouTube video transcripts. Click the extension icon while watching any YouTube video to get an instant summary in a side panel.

## Features

- **One-click summaries** - Click the extension icon or press `Ctrl+Shift+Y` (`Cmd+Shift+Y` on Mac)
- **Streaming responses** - See summaries appear in real-time as they're generated
- **Custom prompts** - Create and manage multiple prompts for different summary styles
- **Model selection** - Choose from 100+ AI models via OpenRouter, with per-prompt defaults
- **Preferred models** - Star your favorite models for quick access
- **Free models filter** - Toggle to show only free models
- **Summary history** - Last 20 summaries saved in an accordion sidebar
- **Transcript chat** - Ask follow-up questions about the video content
- **Smart caching** - Summaries cached per video and prompt combination
- **Markdown rendering** - Summaries display with proper formatting
- **Copy to clipboard** - One-click copy with video title and URL included
- **Configurable font size** - Adjust summary text size to your preference

## Tech Stack

- **TypeScript** - Strict mode with comprehensive type safety
- **React 18** - Side panel and options page UI
- **Vite** - Build tooling with multiple configs
- **Tailwind CSS** - Styling
- **Vitest** - Testing framework
- **OpenRouter API** - AI model access (default: `openai/gpt-4o-mini`)

## Project Structure

```
magpie/
├── extension/              # Chrome extension
│   ├── src/
│   │   ├── service-worker/ # Background script - message routing, API calls
│   │   ├── content-script/ # YouTube page scripts - transcript extraction
│   │   ├── side-panel/     # React UI - summary display
│   │   ├── options/        # React UI - settings page
│   │   ├── types/          # TypeScript type definitions
│   │   └── utils/          # Shared utilities
│   ├── public/             # Static assets, manifest.json
│   └── tests/              # Test files
│
├── landing/                # Marketing website
│   ├── src/
│   │   ├── components/     # React components (Hero, Benefits, FAQ, etc.)
│   │   ├── pages/          # Route pages
│   │   └── content/        # Legal pages (markdown)
│   └── scripts/            # Pre-rendering scripts
│
└── docs/                   # Documentation
    └── architecture/       # Architecture docs
```

## Installation

### Prerequisites

- Node.js 18+
- npm
- Chrome browser
- [OpenRouter API key](https://openrouter.ai/keys)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/fav83/magpie.git
   cd magpie
   ```

2. Install dependencies:
   ```bash
   cd extension
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Navigate to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension/dist` folder

5. Configure the extension:
   - Click the extension icon
   - Go to Options (gear icon)
   - Enter your OpenRouter API key

## Development

Start all watchers in parallel:
```bash
npm run dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development watchers |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run tests |

## Custom Prompts

Prompts use `{transcript}` as a placeholder for the video transcript:

```
Summarize this video in bullet points:

{transcript}
```

You can create multiple prompts for different use cases:
- Detailed summaries
- Key takeaways
- Technical breakdowns
- Study notes

## How It Works

1. **User clicks extension icon** - Opens the side panel
2. **Transcript extraction** - Content script extracts captions from the YouTube player
3. **API call** - Service worker sends transcript to OpenRouter with selected prompt
4. **Summary display** - Side panel renders the markdown-formatted summary
5. **Caching** - Results are cached by video ID and prompt ID

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Side Panel    │────▶│  Service Worker  │────▶│  OpenRouter API │
│    (React)      │◀────│   (Background)   │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Content Script  │
                        │   (YouTube)      │
                        └──────────────────┘
```

## Permissions

The extension requires:
- `storage` - Store API key, prompts, and cache
- `activeTab` - Access current tab URL
- `sidePanel` - Display summary UI
- `scripting` - Inject content scripts
- `webNavigation` - Detect video navigation
- `contextMenus` - Right-click menu integration
- Host permission for `youtube.com`

## Landing Page

The `landing/` directory contains the marketing website built with:

- **React 18** + **TypeScript**
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Puppeteer** for SEO pre-rendering

### Development

```bash
cd landing
npm install
npm run dev
```

### Build

```bash
npm run build           # Standard build
npm run build:prerender # With SEO pre-rendering
```

See `docs/architecture/landing-architecture.md` for detailed documentation.

## License

MIT
