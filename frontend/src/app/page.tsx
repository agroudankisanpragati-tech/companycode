import TopBar from '@/components/TopBar';
import Navbar from '@/components/Navbar';
import VideoBanner from '@/components/VideoBanner';
import HowItWorks from '@/components/HowItWorks';
import Features from '@/components/Features';
import CTA from '@/components/CTA';
import Footer from '@/components/Footer';
import HomeVoiceGuide from '@/components/HomeVoiceGuide';

export default function Home() {
  return (
    <>
      <TopBar />
      <Navbar />
      <main className="w-full">
        <VideoBanner />
        <HowItWorks />
        <Features />
        <CTA />
      </main>
      <Footer />
      <HomeVoiceGuide />
    </>
  );
}
