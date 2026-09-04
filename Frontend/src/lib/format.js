// Presentation-only helpers. No business logic lives here.

export function formatCurrency(amount, currency = "NGN") {
  const value = Number(amount) || 0;
  const symbol = currency === "NGN" ? "₦" : `${currency} `;
  return `${symbol}${value.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}, ${d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function maskAccountNumber(accountNumber = "") {
  if (accountNumber.length < 4) return accountNumber;
  return accountNumber;
}
