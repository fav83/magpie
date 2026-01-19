const steps = [
  {
    number: '01',
    title: 'Install from Chrome Web Store',
    description: 'Add the Magpie extension to your browser with one click.',
    visual: (
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-accent-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-ink-950" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-3.952 6.848a12.014 12.014 0 0 0 9.56-9.404z"/>
          </svg>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-accent-500/50 to-transparent" />
      </div>
    ),
  },
  {
    number: '02',
    title: 'Get your OpenRouter API key',
    description: 'Free to sign up, free models available with rate limits.',
    visual: (
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 border border-accent-500 flex items-center justify-center">
          <svg className="w-6 h-6 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-accent-500/50 to-transparent" />
      </div>
    ),
  },
  {
    number: '03',
    title: 'Summarize and chat',
    description: 'Summarize videos and chat with them using AI.',
    visual: (
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-ink-800 border border-accent-500/30 flex items-center justify-center">
          <svg className="w-6 h-6 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </div>
        <div className="h-px flex-1 bg-transparent" />
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="section bg-ink-900/50 border-y border-cream-400/10">
      <div className="container-narrow">
        {/* Section header */}
        <div className="text-center mb-20">
          <p className="text-accent-500 text-sm tracking-widest uppercase mb-3 animate-slide-up">
            {'>'} getting_started
          </p>
          <h2 className="text-3xl md:text-4xl text-cream-50 font-medium animate-slide-up delay-100">
            Get started in <span className="text-accent-500">3 steps</span>
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-12 md:gap-8">
          {steps.map((step, index) => (
            <div key={step.number} className={`animate-slide-up delay-${(index + 2) * 100}`}>
              {/* Visual element */}
              <div className="mb-6">{step.visual}</div>

              {/* Content */}
              <div className="space-y-3">
                <span className="text-xs text-cream-600 tracking-wider">
                  step[{step.number}]
                </span>
                <h3 className="text-lg text-cream-50 font-medium">{step.title}</h3>
                <p className="text-cream-400 text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
