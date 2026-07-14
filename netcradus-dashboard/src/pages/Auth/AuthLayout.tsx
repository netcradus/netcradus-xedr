import type { PropsWithChildren, ReactNode } from 'react'
import { AuthLogo, WatermarkMark } from '@/components/ui/BrandLogo'

interface AuthLayoutProps {
  headline: ReactNode
  description: string
  features: string[]
}

export default function AuthLayout({
  headline,
  description,
  features,
  children,
}: PropsWithChildren<AuthLayoutProps>) {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-navy-900 via-navy-700 to-[#1a3a7a]">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-16 py-12 relative overflow-hidden text-white">
        {/* Layer 1: background grid + ambient glow */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 30% 50%, rgba(59,111,224,.25) 0%, transparent 60%)',
          }}
        />
        <div
          className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Layer 2 & 3: glow + large watermark logo, centerpiece of the empty space */}
        <div
          className="hidden md:block absolute z-[2] pointer-events-none right-[5%] top-1/2 -translate-y-1/2 w-[120px] md:w-[200px] lg:w-[280px] xl:w-[340px] 2xl:w-[380px]"
          aria-hidden="true"
        >
          {/* Glow behind the logo */}
          <div
            className="absolute -inset-16 rounded-full blur-2xl animate-fade-in-glow"
            style={{
              background:
                'radial-gradient(circle, rgba(249,115,22,0.35) 0%, rgba(59,111,224,0.25) 45%, transparent 75%)',
            }}
          />
          {/* Watermark N-mark */}
          <WatermarkMark />
        </div>

        {/* Layer 4: text content, always on top */}
        <div className="relative z-10 max-w-md">
          <div className="mb-12">
            <AuthLogo />
          </div>

          <h1 className="text-4xl font-bold leading-tight mb-4">{headline}</h1>
          <p className="text-[15px] text-white/65 leading-relaxed mb-10">{description}</p>

          <div className="flex flex-col gap-3.5">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-2.5 text-sm text-white/80">
                <span className="h-2 w-2 rounded-full bg-brand-blue shrink-0" />
                {feature}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="w-full lg:w-[480px] shrink-0 bg-white flex flex-col justify-center px-8 sm:px-12 py-12 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
