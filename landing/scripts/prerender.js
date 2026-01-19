import puppeteer from 'puppeteer';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { discoverRoutes } from './route-discovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function createStaticServer(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = join(distDir, req.url === '/' ? 'index.html' : req.url);

      // If path doesn't exist or is a directory, serve index.html (SPA fallback)
      if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
        filePath = join(distDir, 'index.html');
      }

      const ext = extname(filePath);
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      try {
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

async function prerender() {
  const routes = discoverRoutes();
  console.log(`Pre-rendering ${routes.length} routes...`);

  const port = 3456;
  const server = await createStaticServer(port);
  const baseUrl = `http://localhost:${port}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const route of routes) {
      console.log(`  Rendering: ${route}`);

      const page = await browser.newPage();

      // Navigate directly to the route via HTTP
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0' });

      // Wait for React to render
      await page.waitForSelector('[data-reactroot], #root > *', { timeout: 5000 }).catch(() => {});

      // Wait for Helmet to update the head
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get the rendered HTML
      const html = await page.content();

      // Determine output path
      const outputPath = route === '/'
        ? join(distDir, 'index.html')
        : join(distDir, route.slice(1), 'index.html');

      // Create directory if needed
      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      // Write the pre-rendered HTML
      writeFileSync(outputPath, html);
      console.log(`    -> ${outputPath}`);

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('Pre-rendering complete!');
}

prerender().catch((error) => {
  console.error('Pre-rendering failed:', error);
  process.exit(1);
});
