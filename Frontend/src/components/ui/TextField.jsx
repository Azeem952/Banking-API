import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/format";

export default function TextField({
  label,
  icon: Icon,
  error,
  hint,
  type = "text",
  className,
  inputClassName,
  prefix,
  suffix,
  id,
  ...props
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputId = id || props.name;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-semibold text-ink-900"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
        )}
        {prefix && (
          <div className="absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-sm font-medium text-ink-700">
            {prefix}
          </div>
        )}
        <input
          id={inputId}
          type={isPassword ? (show ? "text" : "password") : type}
          className={cn(
            "h-11 w-full rounded-lg border bg-white text-sm text-ink-900 placeholder:text-ink-400",
            "transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500",
            Icon ? "pl-10" : prefix ? "pl-16" : "pl-3.5",
            isPassword || suffix ? "pr-10" : "pr-3.5",
            error ? "border-danger-500" : "border-surface-300",
            inputClassName
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
        {!isPassword && suffix && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>
      {hint && !error && (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      )}
      {error && <p className="mt-1.5 text-xs font-medium text-danger-500">{error}</p>}
    </div>
  );
}
