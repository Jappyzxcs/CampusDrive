import { Seal } from '../components/common/Seal';
import { Icon } from '../components/common/Icon'; 
import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function AuthLayout({ eyebrow, title, subtitle, children }) {
  const location = useLocation();
  const isRoot = location.pathname === '/'; 
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setIsFlipped((f) => !f), 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid h-screen grid-cols-1 lg:grid-cols-2 overflow-hidden bg-white">
      
      {/* LEFT PANEL (Removed overflow-y-auto to kill the scrollbar) */}
      <div className="relative hidden flex-col bg-primary-900 p-12 text-white lg:flex h-full">
        
        {/* Subtle yellow radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(245,196,0,0.12),transparent_45%)] pointer-events-none" />

        {/* Top Left Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <Seal size="sm" />
          <span className="text-sm font-semibold uppercase tracking-widest text-primary-100">
            CampusDrive
          </span>
        </div>

        {/* Main Center Content */}
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-8 w-full max-w-lg my-12">
          
          <div>
            <h2 className="text-4xl font-bold text-white tracking-tight">LSPU - Campus Drive</h2>
            <p className="mt-2 text-xl font-medium text-primary-200">Los Baños Campus</p>
          </div>

          {/* Auto-flip zone: swaps between the permit card and feature list every 5s */}
          <div className="relative mt-4 h-[236px] [perspective:1200px]">
            <div
              className="relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d]"
              style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
            >
              {/* FRONT — permit card */}
              <div className="absolute inset-0 [backface-visibility:hidden]">
                {/* Flat offset layer behind the card — suggests depth without a drop-shadow */}
                <div className="absolute left-[44px] top-[20px] h-[210px] w-[360px] rotate-[-7deg] rounded-xl bg-primary-950/60" />

                {/* Sample permit card — placeholder data only, never a real registrant's info */}
                <div className="absolute left-[14px] top-0 h-[210px] w-[360px] rotate-[-3deg] rounded-xl bg-[#F3EFE4] p-6 text-primary-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 flex-none rounded-full border-2 border-[#F5C400] bg-primary-900" />
                      <div>
                        <p className="text-sm font-semibold tracking-wide">CAMPUSDRIVE</p>
                        <p className="text-[11px] tracking-wider text-[#8A8570]">VEHICLE PERMIT</p>
                      </div>
                    </div>
                    <svg className="h-6 w-6 text-[#B8860B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  <p className="mt-7 font-mono text-2xl tracking-wide">No. 2027&ndash;00911</p>
                  <p className="mb-5 text-[11px] tracking-wide text-[#8A8570]">JUAN DELA CRUZ</p>

                  <div className="flex items-end justify-between border-t border-dashed border-[#C9C3AF] pt-3">
                    <p className="text-[11px] text-[#8A8570]">VALID THRU 06/2027</p>
                    <div className="grid grid-cols-4 grid-rows-4 gap-[2px]">
                      <div className="h-[5px] w-[5px] bg-primary-900" /><div className="h-[5px] w-[5px]" /><div className="h-[5px] w-[5px] bg-primary-900" /><div className="h-[5px] w-[5px] bg-primary-900" />
                      <div className="h-[5px] w-[5px]" /><div className="h-[5px] w-[5px] bg-primary-900" /><div className="h-[5px] w-[5px]" /><div className="h-[5px] w-[5px] bg-primary-900" />
                      <div className="h-[5px] w-[5px] bg-primary-900" /><div className="h-[5px] w-[5px] bg-primary-900" /><div className="h-[5px] w-[5px]" /><div className="h-[5px] w-[5px] bg-primary-900" />
                      <div className="h-[5px] w-[5px]" /><div className="h-[5px] w-[5px] bg-primary-900" /><div className="h-[5px] w-[5px] bg-primary-900" /><div className="h-[5px] w-[5px]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* BACK — feature highlights */}
              <div
                className="absolute inset-0 flex h-full flex-col justify-center divide-y divide-white/10 rounded-xl border border-white/10 bg-primary-950/40 px-6 [backface-visibility:hidden]"
                style={{ transform: 'rotateY(180deg)' }}
              >
                {[
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <path d="M14 2v6h6" />
                        <path d="M9 13h6M9 17h6" />
                      </svg>
                    ),
                    title: 'Register once, renew in minutes',
                    desc: 'Upload your license and OR/CR, then track your registration status from your phone.',
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2l8 3v6c0 5-3.4 8.6-8 11-4.6-2.4-8-6-8-11V5z" />
                        <path d="M9 12l2 2 4-4" />
                      </svg>
                    ),
                    title: 'Built to catch violations, not just scan stickers',
                    desc: 'Flags mismatched, unregistered, expired, and duplicate stickers the moment a guard scans.',
                  },
                  {
                    icon: (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    ),
                    title: 'One system, every role in sync',
                    desc: 'Registrations, GSU approvals, and guard scans all update the same live record.',
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 h-5 w-5 flex-none text-accent-400">{item.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="mt-1 text-xs leading-snug text-primary-200">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-8 max-w-xs text-sm text-primary-200">
             Every vehicle on campus carries a verified sticker like this one &mdash; checked at every gate.
          </p>

        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="relative flex h-full flex-col overflow-y-auto">
        
        {!isRoot && (
          <div className="absolute top-6 left-6 sm:top-8 sm:left-8 z-20">
            <Link 
              to="/" 
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary-700 transition-colors"
            >
              <Icon name="arrow-left" className="mr-2 h-4 w-4" />
              Back to Portal
            </Link>
          </div>
        )}

        <div className={`flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 ${!isRoot ? 'pt-24 sm:pt-28' : ''}`}>
          <div className="mx-auto w-full max-w-sm">
            
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <Seal size="sm" />
              <span className="text-sm font-semibold uppercase tracking-widest text-primary-800">
                CampusDrive
              </span>
            </div>

            {eyebrow && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent-700">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-semibold text-primary-900">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}

            <div className="mt-8">{children}</div>
          </div>
        </div>

      </div>
    </div>
  );
}