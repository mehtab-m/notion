import React from 'react';
import LandingNavbar from './components/LandingNavbar';
import LandingHero from './components/LandingHero';
import LandingAbout from './components/LandingAbout';
import LandingFeatures from './components/LandingFeatures';
import LandingPricing from './components/LandingPricing';
import LandingTestimonials from './components/LandingTestimonials';
import LandingFooter from './components/LandingFooter';
import './landing.css';

export default function LandingPage() {
  return (
    <div className="landing-root min-h-screen overflow-x-hidden">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingAbout />
        <LandingFeatures />
        <LandingPricing />
        <LandingTestimonials />
      </main>
      <LandingFooter />
    </div>
  );
}
