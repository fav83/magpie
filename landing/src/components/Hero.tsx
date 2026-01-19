import { useState } from 'react';
import { VideoModal } from './VideoModal';

const githubUrl = import.meta.env.VITE_GITHUB_URL || 'https://github.com';
const chromeStoreUrl = import.meta.env.VITE_CHROME_STORE_URL || '#';

export function Hero() {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background gradients */}
      <div className="gradient-blur w-[600px] h-[600px] bg-accent-500 -top-40 -right-40" />
      <div className="gradient-blur w-[400px] h-[400px] bg-accent-600 bottom-20 -left-20 opacity-10" />

      <div className="container-narrow relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
          {/* Left column - Text */}
          <div className="space-y-8 mt-8 lg:mt-0">
            <div className="space-y-4">
              <p className="text-accent-500 text-sm tracking-widest uppercase animate-slide-up">
                {'>'} Open Source Chrome Extension
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl text-cream-50 leading-[1.2] font-medium animate-slide-up delay-100">
                Summarize
                <br />
                <span className="text-cream-400">any YouTube</span>
                <br />
                video with <span className="text-accent-500">AI</span>
              </h1>
            </div>

            <p className="text-xl text-cream-300 max-w-lg leading-relaxed animate-slide-up delay-200">
              Bring your own API key. No accounts, no tracking.
              <span className="text-cream-100"> Just instant summaries.</span>
            </p>

            <div className="flex flex-wrap gap-4 animate-slide-up delay-300">
              <a
                href={chromeStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.56-9.404z"/>
                </svg>
                Add to Chrome
              </a>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                View Source
              </a>
            </div>

            {/* Stats */}
            <div className="flex gap-8 md:gap-12 pt-8 border-t border-cream-400/10 animate-slide-up delay-400">
              <div>
                <p className="text-2xl md:text-3xl font-semibold text-cream-50">300+</p>
                <p className="text-xs text-cream-500 uppercase tracking-wider">models</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-semibold text-accent-500">MIT</p>
                <p className="text-xs text-cream-500 uppercase tracking-wider">license</p>
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-semibold text-cream-50">0</p>
                <p className="text-xs text-cream-500 uppercase tracking-wider">tracking</p>
              </div>
            </div>
          </div>

          {/* Right column - Visual */}
          <div className="relative animate-scale-in delay-300">
            <div className="relative">
              {/* Browser mockup - clickable */}
              <button
                onClick={() => setIsVideoModalOpen(true)}
                className="w-full text-left bg-ink-700 rounded-lg border border-cream-400/30 overflow-hidden shadow-2xl shadow-black/60 cursor-pointer group transition-all duration-300 hover:border-cream-400/40 hover:shadow-accent-500/20 focus:outline-none focus:ring-2 focus:ring-accent-500/50 focus:ring-offset-2 focus:ring-offset-ink-950"
                aria-label="Play demo video"
              >
                {/* Browser chrome */}
                <div className="bg-ink-900 px-4 py-3 flex items-center gap-2 border-b border-cream-400/10">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-ink-600" />
                    <div className="w-3 h-3 rounded-full bg-ink-600" />
                    <div className="w-3 h-3 rounded-full bg-ink-600" />
                  </div>
                  <div className="flex-1 ml-4">
                    <div className="bg-ink-800 rounded px-3 py-1.5 text-xs text-cream-400 font-mono max-w-xs">
                      youtube.com/watch?v=...
                    </div>
                  </div>
                </div>

                {/* Content area */}
                <div className="flex">
                  {/* Video area */}
                  <div className="flex-1 p-4">
                    <div className="aspect-video bg-ink-900 rounded flex items-center justify-center relative overflow-hidden">
                      {/* Play button overlay */}
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-accent-500 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-accent-400 shadow-lg shadow-accent-500/30">
                        <svg className="w-7 h-7 md:w-8 md:h-8 text-ink-950 ml-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      {/* Subtle pulse animation on hover */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-accent-500/20 opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-4 bg-ink-700 rounded w-3/4" />
                      <div className="h-3 bg-ink-700/50 rounded w-1/2" />
                    </div>
                  </div>

                  {/* Side panel */}
                  <div className="w-64 bg-ink-900 border-l border-cream-400/10 p-4 hidden sm:block">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 bg-accent-500 rounded flex items-center justify-center p-1">
                        <svg viewBox="0 0 122 100" fill="white" className="w-full h-full">
                          <path fillRule="evenodd" d="M63.77,73l.9-1.53a126.15,126.15,0,0,1-26.83-2.29c-12.21,3.74-23,7-34.07,10.41A2.53,2.53,0,0,1,2,79a2.46,2.46,0,0,1-1.78-.26c-.69-.7.36-1.07.91-1.19a4,4,0,0,1,.91-.08l7.36-4.68-4,.64c-1.91.88-3.09.71-3.87,0,13.06-9,26.3-16.09,39.09-23.93,7.64-4.69,13.81-11.34,20.88-17.29,6.61-5.56,14-9.15,20.19-11.86C84.19,8.81,89.24,1.15,98.64,0a10.93,10.93,0,0,1,9.52,4.21c6.62.09,12.75.49,14.72,3.59-3.79,2.54-10,3.29-14.16,5-7.21,2.95-4.62,11.26-4.08,17.78s.61,13.87-3.09,21.55c-3.47,7.2-9.52,12.54-18.5,15.79L70.43,74.59c-2.14,1-1.81.76-1.31,3.32.84,4.31,2.66,9.16,4.79,14.78l7.46,1.71c1.21.3.77,4.45-.92,4.25l-10-1.35-9.78,1.86c-1,.32-1.34-4.22-.49-4.63L68.78,93A125.31,125.31,0,0,1,63.37,78.1c-.91-3.06-1.19-2.47.4-5.15ZM101.43,4.4A1.56,1.56,0,1,1,99.87,6a1.55,1.55,0,0,1,1.56-1.56Z"/>
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-cream-100">Summary</span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <div className="h-2 bg-cream-400/20 rounded w-full" />
                        <div className="h-2 bg-cream-400/20 rounded w-5/6" />
                        <div className="h-2 bg-cream-400/20 rounded w-4/6" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 bg-cream-400/10 rounded w-full" />
                        <div className="h-2 bg-cream-400/10 rounded w-3/4" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 bg-cream-400/10 rounded w-full" />
                        <div className="h-2 bg-cream-400/10 rounded w-5/6" />
                        <div className="h-2 bg-cream-400/10 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {/* Floating accent */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent-500 -z-10" />

              {/* Handwritten annotation */}
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1 animate-fade-in delay-500 pointer-events-none">
                {/* Text */}
                <span
                  className="text-cream-300 text-lg md:text-xl whitespace-nowrap"
                  style={{ fontFamily: 'Caveat, cursive' }}
                >
                  Watch it in action!
                </span>
                {/* Arrow pointing down */}
                <svg
                  className="w-8 h-10 text-cream-300 rotate-6"
                  viewBox="0 0 24 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 4 C12 4, 11 24, 12 28" />
                  <path d="M6 22 C8 25, 10 27, 12 28 C14 27, 16 25, 18 22" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Modal */}
      <VideoModal isOpen={isVideoModalOpen} onClose={() => setIsVideoModalOpen(false)} />
    </section>
  );
}
