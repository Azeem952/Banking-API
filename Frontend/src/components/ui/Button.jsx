import { Loader2 } from "lucide-react";
import { cn } from "../../lib/format";

const variants = {
  primary:
    "bg-navy-900 text-white hover:bg-navy-800 disabled:bg-navy-900/50 focus-visible:outline-navy-900",
  accent:
    "bg-accent-500 text-white hover:bg-accent-600 disabled:bg-accent-500/50",
  outline:
    "bg-white text-ink-900 border border-surface-300 hover:bg-surface-50 disabled:opacity-50",
  ghost: "bg-transparent text-ink-700 hover:bg-surface-100 disabled:opacity-50",
  danger: "bg-danger-500 text-white hover:bg-danger-600 disabled:opacity-50",
};

const sizes = {
  md: "h-11 px-5 text-sm",
  sm: "h-9 px-4 text-sm",
  lg: "h-12 px-6 text-[15px]",
};

export default function Button({
  as: Tag = "button",
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}) {
  return (
    <Tag
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors",
        "disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </Tag>
  );
}
