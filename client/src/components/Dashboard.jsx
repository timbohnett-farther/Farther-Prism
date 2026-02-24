/**
 * Farther Prism - Landing Page
 * 
 * Minimal, premium design:
 * - Hero image background
 * - Glass-morphism CTA button
 * - "Less is more" aesthetic
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleBeginPlanning = () => {
    navigate('/planning');
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Hero Image Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/prism-hero.jpg)',
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      
      {/* Subtle overlay for text contrast */}
      <div className="absolute inset-0 bg-black/10" />
      
      {/* Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen">
        {/* Glass-morphism CTA Button */}
        <button
          onClick={handleBeginPlanning}
          className="group relative px-12 py-6 text-2xl font-light tracking-wide text-white transition-all duration-300 hover:scale-105"
        >
          {/* Glass background */}
          <div className="absolute inset-0 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-300 group-hover:bg-white/20 group-hover:border-white/30" />
          
          {/* Shine effect on hover */}
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
          </div>
          
          {/* Button text */}
          <span className="relative z-10">Begin Planning</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
