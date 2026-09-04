import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  Landmark,
  Send,
  Wallet2,
  History,
  UserCircle2,
} from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import StatusBadge from "../components/ui/StatusBadge";
import { formatCurrency, formatDate, cn } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { listTransactions } from "../api/transactionApi";

const QUICK_ACTIONS = [
  { to: "/transfer", label: "Transfer Money", icon: Send },
  { to: "/account", label: "Check Balance", icon: Wallet2 },
  { to: "/transactions", label: "Transaction History", icon: History },
  { to: "/account", label: "Account Details", icon: UserCircle2 },
];

export default function Dashboard() {
  const { user, account } = useAuth();
  const [showBalance, setShowBalance] = useState(true);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listTransactions({ page: 1, limit: 4 }).then((res) => {
      if (active) {
        setRecent(res.items);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const firstName = (user?.email?.split("@")[0] || "User").charAt(0).toUpperCase() + (user?.email?.split("@")[0] || "User").slice(1);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-500">Welcome back, {firstName}</p>
      </div>

      {/* Balance card */}
      <div className="rounded-xl bg-navy-900 p-6 sm:p-7">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-white/60">
              Total Balance
              <button onClick={() => setShowBalance((s) => !s)} aria-label="Toggle balance visibility">
                {showBalance ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            <p className="mt-2 text-3xl font-bold text-white sm:text-4xl">
              {showBalance ? formatCurrency(account.balance) : "₦••••••••"}
            </p>
            <p className="mt-3 text-sm text-white/60">
              Available Balance{" "}
              <span className="font-semibold text-white">
                {showBalance ? formatCurrency(account.balance) : "₦••••••••"}
              </span>
            </p>
          </div>
          <Landmark size={40} className="text-white/20" />
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={label}
            to={to}
            className="flex flex-col items-center justify-center gap-2.5 rounded-xl border border-surface-200 bg-white px-4 py-5 text-center shadow-card transition-colors hover:border-accent-500/40 hover:bg-accent-500/5"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900/5 text-navy-900">
              <Icon size={19} />
            </span>
            <span className="text-xs font-semibold text-ink-900 sm:text-sm">{label}</span>
          </Link>
        ))}
      </div>

      {/* Overview + recent transactions */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account Overview" />
          <dl className="divide-y divide-surface-200 px-6 py-2">
            <Row label="Account Number" value={account.accountNumber} />
            <Row label="Account Name" value={account.accountName} />
            <Row label="Account Type" value="Savings" />
            <Row label="Status" value={<StatusBadge status={account.status} />} />
            <Row label="Opened On" value={formatDate(account.createdAt)} />
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Recent Transactions"
            action={
              <Link
                to="/transactions"
                className="text-sm font-semibold text-accent-500 hover:text-accent-600"
              >
                View all
              </Link>
            }
          />
          <div className="divide-y divide-surface-200 px-6 py-2">
            {loading ? (
              <p className="py-6 text-center text-sm text-ink-500">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">
                No transactions yet.
              </p>
            ) : (
              recent.map((t) => (
                <div key={t.reference} className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{t.description}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{formatDate(t.date)}</p>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-bold",
                      t.direction === "CREDIT" ? "text-success-600" : "text-ink-900"
                    )}
                  >
                    {t.direction === "CREDIT" ? "+" : "−"}
                    {formatCurrency(t.amount)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
