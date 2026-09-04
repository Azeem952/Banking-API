import { cn } from "../../lib/format";

const styles = {
  SUCCESSFUL: "bg-success-50 text-success-600",
  SUCCESS: "bg-success-50 text-success-600",
  VERIFIED: "bg-success-50 text-success-600",
  ACTIVE: "bg-success-50 text-success-600",
  PENDING: "bg-warning-50 text-warning-600",
  FAILED: "bg-danger-50 text-danger-600",
  NOT_STARTED: "bg-surface-200 text-ink-500",
};

const labels = {
  SUCCESSFUL: "Successful",
  SUCCESS: "Successful",
  VERIFIED: "Verified",
  ACTIVE: "Active",
  PENDING: "Pending",
  FAILED: "Failed",
  NOT_STARTED: "Not Started",
};

export default function StatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[status] || "bg-surface-200 text-ink-500",
        className
      )}
    >
      {labels[status] || status}
    </span>
  );
}
