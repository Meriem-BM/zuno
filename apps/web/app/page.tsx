import { Agents } from "./components/Agents";
import { Architecture } from "./components/Architecture";
import { Capabilities } from "./components/Capabilities";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Nav } from "./components/Nav";
import { WhyItMatters } from "./components/WhyItMatters";

export default function Home() {
  return (
    <main className="grain relative min-h-screen">
      <Nav />
      <Hero />
      <div className="hairline mx-auto w-full max-w-6xl px-8" />
      <Capabilities />
      <div className="hairline mx-auto w-full max-w-6xl px-8" />
      <Agents />
      <div className="hairline mx-auto w-full max-w-6xl px-8" />
      <Architecture />
      <div className="hairline mx-auto w-full max-w-6xl px-8" />
      <WhyItMatters />
      <Footer />
    </main>
  );
}
