import React from 'react';

export const GemLogo = ({ className, width = 120, height = 40 }: { className?: string; width?: number; height?: number }) => (
  <svg 
    className={className} 
    width={width} 
    height={height} 
    viewBox="0 0 300 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Geometric Cube Logo - Vectorized from GEM Identity */}
    <g transform="translate(10, 15) scale(0.7)">
      {/* Left Face - Dark Blue */}
      <path d="M50 55 L20 38 L20 72 L50 90 Z" fill="#1E3DC8" />
      {/* Right Face - Teal */}
      <path d="M50 55 L80 38 L80 72 L50 90 Z" fill="#4AC8D4" />
      {/* Top Face - Navy */}
      <path d="M50 18 L80 38 L50 55 L20 38 Z" fill="#0F2080" />
      
      {/* Lettering mapped perfectly to the planes */}
      <text x="34" y="70" fill="white" fontSize="18" fontFamily="sans-serif" fontWeight="bold" style={{ transformOrigin: "35px 68px", transform: "skewY(30deg) scaleX(0.9)" }}>G</text>
      <text x="54" y="77" fill="white" fontSize="18" fontFamily="sans-serif" fontWeight="bold" style={{ transformOrigin: "65px 47px", transform: "skewY(-30deg) scaleX(0.9)" }}>M</text>
      <text x="59" y="32" fill="white" fontSize="15" fontFamily="sans-serif" fontWeight="bold" style={{ transformOrigin: "44px 38px", transform: "scale(1, 0.6) rotate(-45deg)" }}>E</text>
    </g>

    {/* Typography - Minimalist styling adapted to Tailwind defaults */}
    <text x="85" y="62" fill="currentColor" fontSize="32" fontFamily="'Inter', serif" fontWeight="800" letterSpacing="0.02em" className="text-slate-900 dark:text-white">
      GEM GROUP
    </text>
  </svg>
);
