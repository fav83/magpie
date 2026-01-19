import { PageHelmet } from '../components/SEO';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { Benefits } from '../components/Benefits';
import { HowItWorks } from '../components/HowItWorks';
import { FAQ } from '../components/FAQ';
import { Footer } from '../components/Footer';

export default function Home() {
  return (
    <>
      <PageHelmet
        title="Magpie - YouTube Video Summarizer"
        description="Free, open-source Chrome extension to summarize YouTube videos with AI. Bring your own API key. No accounts, no tracking."
        path="/"
      />
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      <Header />
      <main>
        <Hero />
        <Benefits />
        <HowItWorks />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
