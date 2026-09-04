import { cn } from "../../lib/format";

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-surface-200 bg-white shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-surface-200 px-6 py-5",
        className
      )}
    >
      <div>
        <h2 className="text-base font-bold text-ink-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-ink-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
