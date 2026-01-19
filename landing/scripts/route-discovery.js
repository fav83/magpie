import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function discoverRoutes() {
  const routes = ['/'];

  // Add legal pages
  const legalDir = join(__dirname, '../src/content/legal');
  try {
    const legalFiles = readdirSync(legalDir);
    for (const file of legalFiles) {
      if (file.endsWith('.md')) {
        const slug = file.replace('.md', '');
        routes.push(`/${slug}`);
      }
    }
  } catch {
    // Directory doesn't exist yet, add default legal routes
    routes.push('/privacy-policy', '/terms-of-service');
  }

  return routes;
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log('Discovered routes:');
  discoverRoutes().forEach((route) => console.log(`  ${route}`));
}
