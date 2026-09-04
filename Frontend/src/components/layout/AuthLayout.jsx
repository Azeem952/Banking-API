import { ShieldCheck } from "lucide-react";
import Logo from "../ui/Logo";

export default function AuthLayout({
  eyebrow,
  title,
  description,
  footerNote,
  children,
  panelExtra,
}) {
  return (
    <div className="flex min-h-screen w-full bg-surface-50">
      {/* Left brand / hero panel */}
      <aside className="relative hidden w-[380px] shrink-0 flex-col justify-between overflow-hidden bg-navy-900 px-10 py-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-bottom opacity-30"
          style={{
            backgroundImage:
              "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27700%27%3E%3Crect x=%2740%27 y=%27120%27 width=%2790%27 height=%27580%27 fill=%27%23132455%27/%3E%3Crect x=%27150%27 y=%2760%27 width=%27110%27 height=%27640%27 fill=%27%2314275c%27/%3E%3Crect x=%27270%27 y=%27200%27 width=%2780%27 height=%27500%27 fill=%27%23122150%27/%3E%3C/svg%3E')",
          }}
          aria-hidden="true"
        />
        <div className="relative z-10">
          <Logo variant="light" />
          <div className="mt-16 max-w-[280px]">
            <h1 className="text-[34px] font-bold leading-[1.15] text-white">
              {eyebrow}
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/70">
              {description}
            </p>
          </div>
          {panelExtra}
        </div>
        <div className="relative z-10 flex items-center gap-2 text-xs text-white/50">
          <span>© 2026 Nexora Bank. All rights reserved.</span>
        </div>
      </aside>

      {/* Right content panel */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <Logo variant="dark" />
          </div>
          <h2 className="text-[28px] font-bold leading-tight text-ink-900">
            {title}
          </h2>
          {footerNote !== undefined ? (
            <p className="mt-1.5 text-sm text-ink-500">{footerNote}</p>
          ) : null}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

export function TrustNote({ text }) {
  return (
    <div className="mt-10 flex items-start gap-3 text-white/70">
      <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent-500" />
      <p className="text-[13px] leading-relaxed">{text}</p>
    </div>
  );
}
