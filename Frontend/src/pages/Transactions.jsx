import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Card } from "../components/ui/Card";
import StatusBadge from "../components/ui/StatusBadge";
import { cn, formatCurrency, formatDateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { listTransactions } from "../api/transactionApi";

const TYPE_OPTIONS = [
  { value: "ALL", label: "All Transactions" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "FUNDING", label: "Funding" },
];

const STATUS_OPTIONS = [
  { value: "ALL", label: "All Status" },
  { value: "SUCCESS", label: "Successful" },
  { value: "PENDING", label: "Pending" },
  { value: "FAILED", label: "Failed" },
];

const PAGE_SIZE = 6;

export default function Transactions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    type: "ALL",
    status: "ALL",
    from: "",
    to: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listTransactions({ page, limit: PAGE_SIZE, ...filters }).then(
      (res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      }
    );
    return () => {
      active = false;
    };
  }, [page, filters]);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Transactions</h1>
        <p className="mt-1 text-sm text-ink-500">View your transaction history</p>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSelect
            label="Filter By"
            value={filters.type}
            onChange={(v) => updateFilter("type", v)}
            options={TYPE_OPTIONS}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(v) => updateFilter("status", v)}
            options={STATUS_OPTIONS}
          />
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-ink-500">
              Date Range
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => updateFilter("from", e.target.value)}
                className="h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
              <span className="shrink-0 text-ink-400">—</span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
                className="h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
              <CalendarDays size={16} className="shrink-0 text-ink-400" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-500">
              Search
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                placeholder="Search reference"
                value={filters.search}
                onChange={(e) => updateFilter("search", e.target.value)}
                className="h-10 w-full rounded-lg border border-surface-300 bg-white pl-9 pr-3 text-sm text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="mt-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-500">
                    Loading transactions…
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-ink-500">
                    No transactions match your filters.
                  </td>
                </tr>
              ) : (
                data.items.map((t) => (
                  <tr
                    key={t.reference}
                    onClick={() => navigate(`/transactions/${t.reference}`)}
                    className="cursor-pointer hover:bg-surface-50"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 text-ink-500">
                      {formatDateTime(t.date)}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink-900">
                      {t.description}
                    </td>
                    <td className="px-5 py-3.5 text-ink-500">{t.reference}</td>
                    <td className="px-5 py-3.5 text-ink-500">{formatType(t.type)}</td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-5 py-3.5 text-right font-semibold",
                        t.direction === "CREDIT" ? "text-success-600" : "text-ink-900"
                      )}
                    >
                      {t.direction === "CREDIT" ? "+" : "−"}
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && data.items.length > 0 && (
          <div className="flex items-center justify-between border-t border-surface-200 px-5 py-3.5">
            <p className="text-xs text-ink-500">
              Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
              {Math.min(page * PAGE_SIZE, data.totalCount)} of {data.totalCount}{" "}
              transactions
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-300 text-ink-500 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 text-xs font-semibold text-white">
                {page}
              </span>
              <button
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-300 text-ink-500 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function formatType(type) {
  return {
    TRANSFER: "Transfer",
    FUNDING: "Credit",
    NAME_ENQUIRY_FEE: "Fee",
  }[type] || type;
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
