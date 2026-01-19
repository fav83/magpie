import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { PageHelmet } from '../../components/SEO';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';

interface LegalPageProps {
  slug: 'privacy-policy';
}

const pageMeta = {
  'privacy-policy': {
    title: 'Privacy Policy',
    description: 'Privacy Policy for Magpie - YouTube Video Summarizer Chrome Extension',
  },
};

// Import markdown files
const markdownModules = import.meta.glob('../../content/legal/*.md', {
  query: '?raw',
  import: 'default',
});

export default function LegalPage({ slug }: LegalPageProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    const loadContent = async () => {
      const path = `../../content/legal/${slug}.md`;
      const loader = markdownModules[path];
      if (loader) {
        const markdown = (await loader()) as string;
        setContent(markdown);
      }
      setLoading(false);
    };
    loadContent();
  }, [slug]);

  const meta = pageMeta[slug];

  return (
    <>
      <PageHelmet title={meta.title} description={meta.description} path={`/${slug}`} />
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      <Header />
      <main className="pt-32 pb-24">
        <div className="container-narrow">
          <article className="prose prose-invert prose-lg max-w-none
            prose-headings:font-display prose-headings:text-cream-50
            prose-h1:text-4xl prose-h1:md:text-5xl prose-h1:mb-8
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-cream-100
            prose-h3:text-xl prose-h3:text-cream-200
            prose-p:text-cream-300 prose-p:leading-relaxed
            prose-a:text-accent-500 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-cream-100
            prose-ul:text-cream-300 prose-li:marker:text-accent-500
            prose-hr:border-cream-400/10
          ">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-12 bg-ink-800 rounded w-1/2" />
                <div className="h-4 bg-ink-800 rounded w-full" />
                <div className="h-4 bg-ink-800 rounded w-5/6" />
                <div className="h-4 bg-ink-800 rounded w-4/6" />
                <div className="h-8 bg-ink-800 rounded w-1/3 mt-8" />
                <div className="h-4 bg-ink-800 rounded w-full" />
                <div className="h-4 bg-ink-800 rounded w-3/4" />
              </div>
            ) : (
              <ReactMarkdown>{content}</ReactMarkdown>
            )}
          </article>
        </div>
      </main>
      <Footer hideCta />
    </>
  );
}
