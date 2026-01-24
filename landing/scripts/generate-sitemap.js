import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { discoverRoutes } from './route-discovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.production file
const envPath = join(__dirname, '../.env.production');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim();
  });
} catch (e) {
  // Ignore if file doesn't exist
}

// Get site URL from environment or use default
const siteUrl = process.env.VITE_SITE_URL || 'https://magpie.example.com';

function generateSitemap() {
  const routes = discoverRoutes();
  const today = new Date().toISOString().split('T')[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (route) => `  <url>
    <loc>${siteUrl}${route === '/' ? '' : route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${route === '/' ? 'weekly' : 'monthly'}</changefreq>
    <priority>${route === '/' ? '1.0' : '0.5'}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  const outputPath = join(__dirname, '../dist/sitemap.xml');
  writeFileSync(outputPath, sitemap);
  console.log(`Sitemap generated: ${outputPath}`);
  console.log(`  Routes included: ${routes.length}`);
}

generateSitemap();
