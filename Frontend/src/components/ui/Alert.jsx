import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/format";

const config = {
  info: {
    icon: Info,
    classes: "bg-accent-500/5 border-accent-500/20 text-navy-900",
    iconColor: "text-accent-500",
  },
  success: {
    icon: CheckCircle2,
    classes: "bg-success-50 border-success-500/20 text-success-600",
    iconColor: "text-success-500",
  },
  error: {
    icon: XCircle,
    classes: "bg-danger-50 border-danger-500/20 text-danger-600",
    iconColor: "text-danger-500",
  },
  warning: {
    icon: AlertCircle,
    classes: "bg-warning-50 border-warning-500/20 text-warning-600",
    iconColor: "text-warning-500",
  },
};

export default function Alert({ type = "info", children, className }) {
  const { icon: Icon, classes, iconColor } = config[type];
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium",
        classes,
        className
      )}
    >
      <Icon size={18} className={cn("mt-0.5 shrink-0", iconColor)} />
      <div className="leading-snug">{children}</div>
    </div>
  );
}
