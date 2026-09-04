import { cn } from "../../lib/format";

export default function Logo({ variant = "light", className }) {
  const textColor = variant === "light" ? "text-white" : "text-navy-900";
  const subColor = variant === "light" ? "text-accent-500" : "text-accent-600";

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M16 1.5 29.5 9v14L16 30.5 2.5 23V9L16 1.5Z"
          stroke="#2E5CE6"
          strokeWidth="1.6"
        />
        <path d="M16 8 23 12v8l-7 4-7-4v-8l7-4Z" fill="#2E5CE6" />
        <path d="M16 12.5 19.3 14.5v4l-3.3 2-3.3-2v-4L16 12.5Z" fill="#0A1330" />
      </svg>
      <span className={cn("leading-none", textColor)}>
        <span className="block text-lg font-bold tracking-tight">NEXORA</span>
        <span className={cn("block text-[11px] font-semibold tracking-[0.2em]", subColor)}>
          BANK
        </span>
      </span>
    </div>
  );
}
