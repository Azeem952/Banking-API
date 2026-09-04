import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardHeader } from "../components/ui/Card";
import Button from "../components/ui/Button";
import { cn, formatCurrency, formatDateTime } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { getTransactionByReference } from "../api/transactionApi";

export default function TransactionDetail() {
  const { reference } = useParams();
  const { user } = useAuth();

  const [transaction, setTransaction] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getTransactionByReference({ reference })
      .then((t) => active && setTransaction(t))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reference]);

  if (loading) {
    return <p className="text-sm text-ink-500">Loading transaction…</p>;
  }

  if (error || !transaction) {
    return (
      <div className="mx-auto max-w-2xl">
        <BackLink />
        <p className="mt-4 text-sm text-danger-500">{error || "Transaction not found."}</p>
      </div>
    );
  }

  const t = transaction;
  const isDebit = t.direction === "DEBIT";

  return (
    <div className="mx-auto max-w-4xl">
      <BackLink />

      <h1 className="mt-3 text-2xl font-bold text-ink-900">Transaction Details</h1>
      <p className="mt-1 text-sm text-ink-500">
        View detailed information about this transaction
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-surface-200 px-6 py-5">
            <StatusIcon status={t.status} />
            <div>
              <p className="text-base font-bold text-ink-900">
                {t.status === "SUCCESS"
                  ? "Successful"
                  : t.status === "PENDING"
                  ? "Pending"
                  : "Failed"}
              </p>
              <p className="text-sm text-ink-500">
                {t.status === "SUCCESS"
                  ? "This transaction was completed successfully."
                  : t.status === "PENDING"
                  ? "This transaction is still being processed."
                  : "This transaction could not be completed."}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-surface-200 px-6 py-2">
            <Row
              label="Amount"
              value={
                <span className={isDebit ? "text-ink-900" : "text-success-600"}>
                  {isDebit ? "−" : "+"}
                  {formatCurrency(t.amount)}
                </span>
              }
            />
            <Row label="Type" value={isDebit ? "Debit" : "Credit"} />
            <Row label="Description" value={t.description} />
            <Row label="Reference" value={t.reference} />
            <Row label="Date & Time" value={formatDateTime(t.date)} />
            {t.fromAccount && <Row label="From Account" value={t.fromAccount} />}
            {t.toAccount && (
              <Row label="To Account" value={`${t.toAccount} · ${t.toAccountName}`} />
            )}
            {t.toBankName && <Row label="Destination Bank" value={t.toBankName} />}
            {t.narration && t.narration !== "—" && (
              <Row label="Narration" value={t.narration} />
            )}
            <Row label="Channel" value={t.channel} />
          </dl>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Transaction Status" />
            <div className="px-6 py-5">
              <Timeline status={t.status} date={t.date} />
            </div>
          </Card>

          <Card className="bg-accent-500/5 p-5">
            <p className="text-sm font-bold text-ink-900">Need Help?</p>
            <p className="mt-1 text-sm text-ink-500">
              If you have any issues with this transaction, please contact our
              support team.
            </p>
            <Button variant="outline" size="sm" className="mt-4 w-full">
              Contact Support
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/transactions"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
    >
      <ChevronLeft size={16} />
      Back to Transactions
    </Link>
  );
}

function StatusIcon({ status }) {
  if (status === "SUCCESS") {
    return (
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-50">
        <CheckCircle2 size={22} className="text-success-500" />
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warning-50">
        <Clock size={22} className="text-warning-500" />
      </span>
    );
  }
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger-50">
      <XCircle size={22} className="text-danger-500" />
    </span>
  );
}

function Timeline({ status, date }) {
  const steps = [
    { label: "Initiated", done: true, timestamp: date },
    { label: "Processing", done: status !== "FAILED", timestamp: date },
    {
      label: status === "FAILED" ? "Failed" : "Completed",
      done: status === "SUCCESS" || status === "FAILED",
      timestamp: status === "PENDING" ? null : date,
    },
  ];

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, idx) => (
        <li key={step.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "flex h-3 w-3 shrink-0 rounded-full",
                step.done
                  ? status === "FAILED" && idx === steps.length - 1
                    ? "bg-danger-500"
                    : "bg-success-500"
                  : "bg-surface-300"
              )}
            />
            {idx < steps.length - 1 && (
              <div className="my-1 h-10 w-px bg-surface-300" />
            )}
          </div>
          <div className="pb-4">
            <p
              className={cn(
                "text-sm font-medium",
                step.done ? "text-ink-900" : "text-ink-400"
              )}
            >
              {step.label}
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              {step.timestamp ? formatDateTime(step.timestamp) : "—"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd className="text-right font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
