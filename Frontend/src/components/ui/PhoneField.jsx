import { ChevronDown, Phone } from "lucide-react";

// Country code is fixed to +234 (Nigeria) to match NIBSS's scope — no other
// country's phone numbers are valid input for this system, so the dropdown
// affordance from the design is shown but intentionally non-interactive.
export default function PhoneField({ label, value, onChange, error, ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-ink-900">
          {label}
        </label>
      )}
      <div className="flex gap-2">
        <div className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-surface-300 bg-white px-3 text-sm font-medium text-ink-900">
          <Phone size={16} className="text-ink-400" />
          <span>+234</span>
          <ChevronDown size={14} className="text-ink-400" />
        </div>
        <input
          type="tel"
          value={value}
          onChange={onChange}
          placeholder="Enter your phone number"
          className={`h-11 w-full rounded-lg border bg-white px-3.5 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 ${
            error ? "border-danger-500" : "border-surface-300"
          }`}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-danger-500">{error}</p>}
    </div>
  );
}
