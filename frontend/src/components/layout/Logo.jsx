import React from 'react';

const Logo = ({ size = "md", showText = true, className = "", subtext = "", showDecoration = false }) => {
  const sizes = {
    sm: {
      container: "w-8 h-8 rounded-xl",
      text: "text-lg",
      brandX: "text-sm",
      decoration: "h-0.5 w-8",
      mark: "text-[13px] font-black",
      gap: "gap-0.5"
    },
    md: {
      container: "w-10 h-10 rounded-2xl",
      text: "text-2xl",
      brandX: "text-base",
      decoration: "h-1 w-12",
      mark: "text-[16px] font-black",
      gap: "gap-0.5"
    },
    lg: {
      container: "h-16 w-16 rounded-3xl",
      text: "text-[2.75rem]",
      brandX: "text-2xl",
      decoration: "h-1.5 w-16",
      mark: "text-[26px] font-black",
      gap: "gap-1"
    }
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-3 transition-all ${className}`} role="img" aria-label="Aicon X Logo">
      {/* Icon Mark */}
      <div
        className={`${currentSize.container} shrink-0 relative overflow-hidden flex items-center justify-center transition-transform hover:scale-105 active:scale-95`}
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          boxShadow: '0 4px 20px rgba(249,115,22,0.25), 0 1px 4px rgba(0,0,0,0.3)',
        }}
      >
        {/* Glow orb */}
        <div className="absolute top-0 right-0 w-4 h-4 rounded-full opacity-40" style={{ background: 'radial-gradient(circle, #f97316, transparent)', transform: 'translate(30%, -30%)' }} />

        {/* "Ai" text mark */}
        <span
          className={`${currentSize.mark} leading-none tracking-tight select-none z-10`}
          style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.04em' }}
        >
          <span style={{ color: '#ffffff', fontWeight: 900 }}>A</span>
          <span style={{ color: '#f97316', fontWeight: 900 }}>i</span>
        </span>

        {/* Bottom edge accent */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #f97316, transparent)' }} />
      </div>

      {showText && (
        <div className={`flex flex-col gap-0.5 ${className.includes('flex-col') ? 'items-center' : ''}`}>
          <div className={`${currentSize.text} font-black tracking-tight leading-none flex items-baseline gap-[2px]`}>
            <span className="text-slate-800 dark:text-white" style={{ letterSpacing: '-0.03em' }}>aicon</span>
            <span
              className={`${currentSize.brandX} font-black`}
              style={{
                background: 'linear-gradient(135deg, #f97316, #ef4444)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.02em',
              }}
            >
              x
            </span>
          </div>
          {showDecoration && (
            <div className={`${currentSize.decoration} rounded-full`} style={{ background: 'linear-gradient(90deg, #f97316, #ef4444)' }} />
          )}
          {subtext && (
            <p className="text-slate-400 font-semibold tracking-[0.18em] text-[9px] uppercase">
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
