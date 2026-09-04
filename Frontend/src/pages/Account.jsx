import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Landmark } from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import StatusBadge from "../components/ui/StatusBadge";
import { cn, formatCurrency, formatDate } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { createAccount } from "../api/accountApi";

const STEPS = ["Verify Identity", "Create Account", "Account Created"];

export default function Account() {
  const { user, account, refresh } = useAuth();
  const navigate = useNavigate();

  const [accountName, setAccountName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const stepIndex = account ? 2 : 1;

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await createAccount({
        accountName: accountName || "Personal Savings Account",
        preferredName,
      });
      refresh();
    } catch (err) {
      setError(err.message || "Could not create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Account</h1>
        <p className="mt-1 text-sm text-ink-500">
          Create and manage your bank account
        </p>
      </div>

      <StepIndicator stepIndex={stepIndex} />

      <Card className="mt-6">
        {account ? (
          <AccountCreated account={account} onGoToDashboard={() => navigate("/dashboard")} />
        ) : (
          <>
            <CardHeader
              title="Account Information"
              description="Set up your primary savings account"
            />
            <form onSubmit={handleCreate} className="flex flex-col gap-5 px-6 py-6">
              {error && <Alert type="error">{error}</Alert>}

              <TextField
                label="Account Name"
                placeholder="e.g. Personal Savings Account"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
              <TextField
                label="Preferred Account Name"
                placeholder="e.g. My Savings"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
              />

              <Alert type="info">
                You can only create one account. Your account will be credited with
                ₦15,000 after successful creation.
              </Alert>

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {loading ? "Creating Account…" : "Create Account"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

function StepIndicator({ stepIndex }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {STEPS.map((label, idx) => {
        const done = idx < stepIndex;
        const active = idx === stepIndex;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  done
                    ? "bg-success-500 text-white"
                    : active
                    ? "bg-accent-500 text-white"
                    : "bg-surface-200 text-ink-500"
                )}
              >
                {done ? <Check size={12} /> : idx + 1}
              </span>
              <span
                className={cn(
                  "whitespace-nowrap font-medium",
                  done || active ? "text-ink-900" : "text-ink-400"
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-surface-300" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AccountCreated({ account, onGoToDashboard }) {
  return (
    <div className="px-6 py-8">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-50">
          <Landmark size={26} className="text-success-500" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-ink-900">Account Created Successfully</h3>
        <p className="mt-1 text-sm text-ink-500">
          Your account has been funded with {formatCurrency(15000)}.
        </p>
      </div>

      <dl className="mt-8 divide-y divide-surface-200 rounded-lg border border-surface-200">
        <Row label="Account Number" value={account.accountNumber} />
        <Row label="Account Name" value={account.accountName} />
        <Row label="Preferred Name" value={account.preferredName} />
        <Row label="Balance" value={formatCurrency(account.balance)} />
        <Row label="Status" value={<StatusBadge status={account.status} />} />
        <Row label="Opened On" value={formatDate(account.createdAt)} />
      </dl>

      <Button size="lg" className="mt-6 w-full" onClick={onGoToDashboard}>
        Go to Dashboard
      </Button>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
