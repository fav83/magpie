const benefits = [
  {
    title: 'Open Source',
    description: 'Fully transparent. Inspect the code, contribute, fork it.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
    number: '01',
  },
  {
    title: 'Bring Your Own Key',
    description: 'Use your OpenRouter API key. You control your data and costs.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    number: '02',
  },
  {
    title: 'Custom Prompts',
    description: 'Create prompts for bullet points, detailed analysis, study notes, whatever you need.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
    number: '03',
  },
  {
    title: 'Chat with Videos',
    description: 'Ask follow-up questions about the video content.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    number: '04',
  },
];

export function Benefits() {
  return (
    <section className="section border-t border-cream-400/10">
      <div className="container-narrow">
        {/* Section header */}
        <div className="flex items-end justify-between mb-16">
          <div>
            <p className="text-accent-500 text-sm tracking-widest uppercase mb-3 animate-slide-up">
              {'>'} features
            </p>
            <h2 className="text-3xl md:text-4xl text-cream-50 font-medium animate-slide-up delay-100">
              Why <span className="text-accent-500">Magpie</span>?
            </h2>
          </div>
          <p className="hidden md:block text-cream-500 text-sm max-w-xs text-right animate-slide-up delay-200">
            // Works with OpenRouter models
          </p>
        </div>

        {/* Benefits grid */}
        <div className="grid md:grid-cols-2 gap-px bg-cream-400/10">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className={`card-dark p-8 md:p-10 animate-slide-up delay-${(index + 2) * 100}`}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="text-accent-500">{benefit.icon}</div>
                <span className="text-xs text-cream-600">[{benefit.number}]</span>
              </div>
              <h3 className="text-xl text-cream-50 font-medium mb-3">{benefit.title}</h3>
              <p className="text-cream-400 text-sm leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Mobile tagline */}
        <p className="md:hidden text-cream-400 text-center mt-8 animate-slide-up delay-600">
          Works with OpenRouter models; pay only for API usage.
        </p>
      </div>
    </section>
  );
}
