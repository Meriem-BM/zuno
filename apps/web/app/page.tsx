import { Architecture } from "./components/Architecture";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { Nav } from "./components/Nav";
import { WhyItMatters } from "./components/WhyItMatters";

export default function Home() {
  return (
    <main className="grain relative min-h-screen">
      <Nav />
      <Hero />
      <div className="hairline mx-auto w-full max-w-6xl px-8" />
      <HowItWorks />
      <div className="hairline mx-auto w-full max-w-6xl px-8" />
      <WhyItMatters />
      <div className="hairline mx-auto w-full max-w-6xl px-8" />
      <Architecture />
      <Footer />
    </main>
  );
}
