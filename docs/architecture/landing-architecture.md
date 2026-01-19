# Landing Page Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 18.x |
| Language | TypeScript | 5.x (strict mode) |
| Build Tool | Vite | 5.x |
| Styling | Tailwind CSS | 3.x |
| CSS Processing | PostCSS + Autoprefixer | - |
| SEO | React Helmet Async | 2.x |
| Routing | React Router DOM | 6.x |
| Markdown | React Markdown | 9.x |
| Pre-rendering | Puppeteer | 24.x |

## Folder Structure

```
landing/
├── public/
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png
│   ├── hero-image.svg              # Hero section illustration
│   ├── logo.svg                    # Magpie logo
│   ├── robots.txt
│   └── staticwebapp.config.json    # Azure Static Web Apps config
│
├── src/
│   ├── main.tsx                    # React DOM entry with HelmetProvider
│   ├── App.tsx                     # Router configuration
│   ├── index.css                   # Global styles + Tailwind
│   │
│   ├── components/
│   │   ├── Header.tsx              # Navigation bar
│   │   ├── Hero.tsx                # Hero section with CTAs
│   │   ├── VideoModal.tsx          # Video modal component
│   │   ├── Benefits.tsx            # 4 benefit cards
│   │   ├── HowItWorks.tsx          # 3-step process
│   │   ├── FAQ.tsx                 # FAQ accordion
│   │   ├── Footer.tsx              # Footer with links
│   │   └── SEO/
│   │       ├── PageHelmet.tsx      # Reusable SEO component
│   │       └── index.ts
│   │
│   ├── pages/
│   │   ├── Home.tsx                # Landing page (/)
│   │   └── legal/
│   │       └── LegalPage.tsx       # Shared component for legal pages
│   │
│   └── content/
│       └── legal/
│           └── privacy-policy.md   # Privacy policy content
│
├── scripts/
│   ├── prerender.js                # Puppeteer static pre-rendering
│   ├── build-with-prerender.js     # Build orchestration
│   ├── route-discovery.js          # Dynamic route detection
│   └── generate-sitemap.js         # Sitemap generation
│
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── postcss.config.js
├── eslint.config.js
├── package.json
├── .env.development
└── .env.production
```

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Home` | Main landing page |
| `/privacy-policy` | `LegalPage` | Privacy policy (renders markdown) |

## Legal Pages

Legal pages use markdown content:
- Markdown files stored in `src/content/legal/`
- Shared `LegalPage` component renders markdown with consistent styling
- Uses React Markdown for rendering
- Wrapped in standard page layout with Header and Footer

## Component Hierarchy

```
Home (page)
├── PageHelmet (SEO meta tags)
├── Header
│   ├── Logo
│   └── Navigation (GitHub link, Chrome Web Store)
├── Hero
│   ├── Headline + Subheadline
│   ├── CTA buttons (Add to Chrome, View on GitHub)
│   └── Hero image/screenshot
├── Benefits (4 cards)
│   ├── Open Source
│   ├── Bring Your Own Key
│   ├── Custom Prompts
│   └── Chat with Videos
├── HowItWorks (3 steps)
├── FAQ (accordion)
└── Footer
    ├── CTA section (optional)
    └── Links (GitHub, Privacy)
```

## Build & Deployment

### NPM Scripts

```json
{
  "dev": "vite",
  "build": "npm run build:no-prerender && node scripts/generate-sitemap.js",
  "build:no-prerender": "tsc -b && vite build",
  "build:prerender": "npm run build:no-prerender && node scripts/build-with-prerender.js && node scripts/generate-sitemap.js",
  "preview": "vite preview --port 4173",
  "lint": "eslint ."
}
```

### Environment Variables

```env
# .env.production
VITE_SITE_URL=https://magpie.fav83.com
VITE_CHROME_STORE_URL=https://chrome.google.com/webstore/detail/magpie
VITE_GITHUB_URL=https://github.com/fav83/magpie
```

## Pre-rendering for SEO

Puppeteer-based static pre-rendering ensures:
- Fully rendered HTML for search engine crawlers
- Meta tags (Open Graph, Twitter Cards) baked into HTML
- Fast initial page load

Process:
1. Build React app with Vite
2. Puppeteer loads each route
3. Waits for React Helmet to render
4. Captures final HTML
5. Saves as static `index.html` per route

## Styling Patterns

### Design Philosophy

Dark technical aesthetic with:
- Rich blacks and warm cream text for high contrast readability
- Red accent color matching the extension icon (`#ef4444`)
- Monospace typography throughout (JetBrains Mono) for a technical, developer-focused feel

### Tailwind Configuration

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0a0a',  // Deepest background
          900: '#0f0f0f',  // Card backgrounds
          800: '#171717',
          700: '#262626',
          600: '#404040',
          500: '#525252',
        },
        cream: {
          50: '#fefdfb',   // Brightest text
          100: '#faf8f3',
          200: '#f5f0e6',
          300: '#e8dfd0',
          400: '#d4c4a8',
          500: '#a8977a',
          600: '#7a6f5a',  // Muted text
        },
        accent: {
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',  // Primary accent (matches extension icon)
          600: '#dc2626',
          700: '#b91c1c',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
```

### Animation Classes

Custom CSS animations in `index.css`:
- `animate-fade-in` - Opacity fade on load
- `animate-slide-up` - Elements slide up with opacity fade
- `animate-slide-in-left` - Elements slide in from left
- `animate-scale-in` - Scale up with opacity fade
- `animate-modal-backdrop-in` / `animate-modal-content-in` - Modal animations
- Staggered delays via `delay-100` through `delay-800` utility classes

## SEO Implementation

### PageHelmet Component

Standardized SEO across all pages:
- Title and description
- Canonical URL
- Open Graph tags (title, description, image, url)
- Twitter Card tags

### robots.txt

```
User-agent: *
Allow: /

Sitemap: https://magpie.fav83.com/sitemap.xml
```

## Future Considerations

When adding a blog/guides section later:
- Add MDX support via `@mdx-js/rollup` Vite plugin
- Create `src/content/guides/` for MDX files
- Add `src/features/blog/` module with:
  - MDX loader using `import.meta.glob()`
  - TOC generator
  - Blog components (BlogIndex, BlogPost, BlogCard)
- Add routes: `/guides` (listing) and `/guides/:slug` (posts)
