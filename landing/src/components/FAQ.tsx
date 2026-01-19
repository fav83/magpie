import { useState, ReactNode } from 'react';

const faqs: { question: string; answer: ReactNode }[] = [
  {
    question: 'What is OpenRouter?',
    answer:
      'OpenRouter is a unified API gateway that gives you access to hundreds of AI models from different providers (OpenAI, Anthropic, Google, Meta, and more) through a single API key. You pay only for what you use.',
  },
  {
    question: 'How do I get an OpenRouter API key?',
    answer: (
      <>
        Sign up at{' '}
        <a
          href="https://openrouter.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-500 hover:underline"
        >
          openrouter.ai
        </a>
        , go to your account settings, and generate an API key. No payment method required to start.
      </>
    ),
  },
  {
    question: 'How many models can I use?',
    answer: '500+ models from 60+ providers. Including free models, GPT-5, Claude, Gemini, Llama, GLM, DeepSeek, and many more.',
  },
  {
    question: 'Are there free models I can use?',
    answer: (
      <>
        Yes. OpenRouter offers{' '}
        <a
          href="https://openrouter.ai/models?q=free"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-500 hover:underline"
        >
          free models
        </a>{' '}
        with rate limits. No payment required to try them out.
      </>
    ),
  },
  {
    question: 'How do I get the best summary?',
    answer:
      'Play around with prompts and models. Create custom prompts for different use cases (quick bullets, detailed analysis, study notes) and try different models to see what works best for your needs.',
  },
  {
    question: 'How much does it cost?',
    answer:
      'The extension is free and open-source. You pay only for API usage with OpenRouter — and there are free models available if you want to start at zero cost.',
  },
  {
    question: 'What data do you collect?',
    answer:
      "None. Your API key stays in your browser. We don't track you, don't have accounts, don't collect analytics.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="section">
      <div className="container-narrow">
        <div className="grid lg:grid-cols-5 gap-16">
          {/* Left column - Header */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-32">
              <p className="text-accent-500 text-sm tracking-widest uppercase mb-3 animate-slide-up">
                {'>'} faq
              </p>
              <h2 className="text-3xl md:text-4xl text-cream-50 font-medium mb-6 animate-slide-up delay-100">
                Questions?
                <br />
                <span className="text-cream-400">Answers.</span>
              </h2>
              <p className="text-cream-500 text-sm leading-relaxed animate-slide-up delay-200">
                // Everything you need to know
              </p>
            </div>
          </div>

          {/* Right column - Questions */}
          <div className="lg:col-span-3">
            <div className="divide-y divide-cream-400/10">
              {faqs.map((faq, index) => (
                <div key={index} className={`animate-slide-up delay-${Math.min((index + 1) * 100, 800)}`}>
                  <button
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                    className="w-full py-6 flex items-start justify-between text-left group"
                  >
                    <span className="text-base text-cream-100 group-hover:text-accent-500 transition-colors pr-8">
                      {faq.question}
                    </span>
                    <span
                      className={`flex-shrink-0 w-8 h-8 border border-cream-400/20 flex items-center justify-center transition-all duration-300 ${
                        openIndex === index ? 'bg-accent-500 border-accent-500 rotate-45' : 'group-hover:border-accent-500/50'
                      }`}
                    >
                      <svg
                        className={`w-4 h-4 transition-colors ${openIndex === index ? 'text-ink-950' : 'text-cream-400'}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openIndex === index ? 'max-h-96 pb-6' : 'max-h-0'
                    }`}
                  >
                    <p className="text-cream-400 text-sm leading-relaxed pr-16">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
