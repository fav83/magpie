import { Link } from 'react-router-dom';

const githubUrl = import.meta.env.VITE_GITHUB_URL || 'https://github.com';
const chromeStoreUrl = import.meta.env.VITE_CHROME_STORE_URL || '#';

interface FooterProps {
  hideCta?: boolean;
}

export function Footer({ hideCta = false }: FooterProps) {
  return (
    <footer className="border-t border-cream-400/10">
      {/* CTA Section */}
      {!hideCta && <div className="section bg-ink-900/30">
        <div className="container-narrow">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl text-cream-50 font-medium mb-6 animate-slide-up">
              Ready to save hours on <span className="text-accent-500">YouTube</span>?
            </h2>
            <p className="text-cream-400 text-sm mb-10 animate-slide-up delay-100">
              // Open source. No tracking. Just summaries.
            </p>
            <div className="flex flex-wrap justify-center gap-4 animate-slide-up delay-200">
              <a href={chromeStoreUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.56-9.404z"/>
                </svg>
                Add to Chrome
              </a>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </div>}

      {/* Bottom bar */}
      <div className="py-8 border-t border-cream-400/5">
        <div className="container-narrow">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-accent-500 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110 p-1.5">
                <svg viewBox="0 0 122 100" fill="white" className="w-full h-full">
                  <path fillRule="evenodd" d="M63.77,73l.9-1.53a126.15,126.15,0,0,1-26.83-2.29c-12.21,3.74-23,7-34.07,10.41A2.53,2.53,0,0,1,2,79a2.46,2.46,0,0,1-1.78-.26c-.69-.7.36-1.07.91-1.19a4,4,0,0,1,.91-.08l7.36-4.68-4,.64c-1.91.88-3.09.71-3.87,0,13.06-9,26.3-16.09,39.09-23.93,7.64-4.69,13.81-11.34,20.88-17.29,6.61-5.56,14-9.15,20.19-11.86C84.19,8.81,89.24,1.15,98.64,0a10.93,10.93,0,0,1,9.52,4.21c6.62.09,12.75.49,14.72,3.59-3.79,2.54-10,3.29-14.16,5-7.21,2.95-4.62,11.26-4.08,17.78s.61,13.87-3.09,21.55c-3.47,7.2-9.52,12.54-18.5,15.79L70.43,74.59c-2.14,1-1.81.76-1.31,3.32.84,4.31,2.66,9.16,4.79,14.78l7.46,1.71c1.21.3.77,4.45-.92,4.25l-10-1.35-9.78,1.86c-1,.32-1.34-4.22-.49-4.63L68.78,93A125.31,125.31,0,0,1,63.37,78.1c-.91-3.06-1.19-2.47.4-5.15ZM101.43,4.4A1.56,1.56,0,1,1,99.87,6a1.55,1.55,0,0,1,1.56-1.56Z"/>
                </svg>
              </div>
              <span className="text-cream-100">Magpie</span>
            </Link>

            {/* Links */}
            <nav className="flex flex-wrap justify-center gap-8 text-sm">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cream-500 hover:text-accent-500 transition-colors"
              >
                GitHub
              </a>
              <Link to="/privacy-policy" className="text-cream-500 hover:text-accent-500 transition-colors">
                Privacy
              </Link>
            </nav>

            {/* Copyright */}
            <p className="text-xs text-cream-600">
              // YouTube video summarizer
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
