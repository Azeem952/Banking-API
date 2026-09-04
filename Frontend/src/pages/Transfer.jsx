import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Landmark,
  Building2,
  Search,
  Check,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import { Card } from "../components/ui/Card";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import { cn, formatCurrency } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { nameEnquiry, transferFunds, BANKS } from "../api/transferApi";

const STEPS = ["Enter Details", "Review", "Confirm"];

const initialRecipient = {
  accountNumber: "",
  bankCode: BANKS[0].code,
  resolvedName: null,
  resolvedBank: null,
  enquiryStatus: "idle", // idle | loading | found | error
  enquiryError: "",
};

export default function Transfer() {
  const { user, account, refresh } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [transferType, setTransferType] = useState("INTRA_BANK");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [amountError, setAmountError] = useState("");

  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | processing | done
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState("");

  function resetAll() {
    setStep(0);
    setTransferType("INTRA_BANK");
    setRecipient(initialRecipient);
    setAmount("");
    setNarration("");
    setAmountError("");
    setSubmitStatus("idle");
    setResult(null);
    setSubmitError("");
  }

  function handleTypeChange(type) {
    setTransferType(type);
    setRecipient(initialRecipient);
  }

  function handleAccountNumberChange(value) {
    const digits = value.replace(/[^\d]/g, "").slice(0, 10);
    setRecipient((r) => ({
      ...r,
      accountNumber: digits,
      resolvedName: null,
      resolvedBank: null,
      enquiryStatus: "idle",
      enquiryError: "",
    }));
  }

  async function handleEnquire() {
    if (!/^\d{10}$/.test(recipient.accountNumber)) {
      setRecipient((r) => ({
        ...r,
        enquiryStatus: "error",
        enquiryError: "Enter a valid 10-digit account number.",
      }));
      return;
    }
    setRecipient((r) => ({ ...r, enquiryStatus: "loading", enquiryError: "" }));
    try {
      const res = await nameEnquiry({
        accountNumber: recipient.accountNumber,
        bankCode: transferType === "INTRA_BANK" ? "703" : recipient.bankCode,
        isInterBank: transferType === "INTER_BANK",
      });
      refresh();
      setRecipient((r) => ({
        ...r,
        enquiryStatus: "found",
        resolvedName: res.accountName,
        resolvedBank: res.bankName,
      }));
    } catch (err) {
      refresh();
      setRecipient((r) => ({
        ...r,
        enquiryStatus: "error",
        enquiryError: err.message,
        resolvedName: null,
      }));
    }
  }

  function validateAmount() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setAmountError("Enter an amount greater than zero.");
      return false;
    }
    if (value > account.balance) {
      setAmountError("Amount exceeds your available balance.");
      return false;
    }
    setAmountError("");
    return true;
  }

  function handleContinue() {
    if (recipient.enquiryStatus !== "found") return;
    if (!validateAmount()) return;
    setStep(1);
  }

  async function handleConfirm() {
    setStep(2);
    setSubmitStatus("processing");
    setSubmitError("");
    try {
      const record = await transferFunds({
        transferType,
        fromAccount: account.id,
        toAccount: recipient.accountNumber,
        toAccountName: recipient.resolvedName,
        toBankCode: transferType === "INTRA_BANK" ? "703" : recipient.bankCode,
        toBankName: recipient.resolvedBank,
        amount,
        narration,
      });
      refresh();
      setResult(record);
      setSubmitStatus("done");
    } catch (err) {
      setSubmitError(err.message || "Transfer failed. Please try again.");
      setSubmitStatus("done");
      setResult(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">Transfer Money</h1>
        <p className="mt-1 text-sm text-ink-500">Send money to other accounts</p>
      </div>

      <StepIndicator activeIndex={step} />

      <Card className="mt-6 p-6">
        {step === 0 && (
          <DetailsStep
            transferType={transferType}
            onTypeChange={handleTypeChange}
            recipient={recipient}
            onAccountNumberChange={handleAccountNumberChange}
            onBankChange={(bankCode) =>
              setRecipient((r) => ({
                ...r,
                bankCode,
                resolvedName: null,
                enquiryStatus: "idle",
                enquiryError: "",
              }))
            }
            onEnquire={handleEnquire}
            amount={amount}
            onAmountChange={(v) => {
              setAmount(v.replace(/[^\d.]/g, ""));
              setAmountError("");
            }}
            amountError={amountError}
            narration={narration}
            onNarrationChange={setNarration}
            balance={account.balance}
            onContinue={handleContinue}
          />
        )}

        {step === 1 && (
          <ReviewStep
            transferType={transferType}
            fromAccount={account}
            recipient={recipient}
            amount={amount}
            narration={narration}
            onBack={() => setStep(0)}
            onConfirm={handleConfirm}
          />
        )}

        {step === 2 && (
          <ConfirmStep
            status={submitStatus}
            result={result}
            error={submitError}
            onViewTransaction={() =>
              navigate(`/transactions/${result?.reference}`)
            }
            onAnother={resetAll}
          />
        )}
      </Card>
    </div>
  );
}

function StepIndicator({ activeIndex }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {STEPS.map((label, idx) => {
        const done = idx < activeIndex;
        const active = idx === activeIndex;
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
            {idx < STEPS.length - 1 && <div className="h-px flex-1 bg-surface-300" />}
          </div>
        );
      })}
    </div>
  );
}

function DetailsStep({
  transferType,
  onTypeChange,
  recipient,
  onAccountNumberChange,
  onBankChange,
  onEnquire,
  amount,
  onAmountChange,
  amountError,
  narration,
  onNarrationChange,
  balance,
  onContinue,
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-900">Transfer Type</p>
        <div className="grid grid-cols-2 gap-3">
          <TypeOption
            icon={Landmark}
            title="Intra-bank Transfer"
            subtitle="Within Nexora Bank"
            selected={transferType === "INTRA_BANK"}
            onClick={() => onTypeChange("INTRA_BANK")}
          />
          <TypeOption
            icon={Building2}
            title="Inter-bank Transfer"
            subtitle="To other banks"
            selected={transferType === "INTER_BANK"}
            onClick={() => onTypeChange("INTER_BANK")}
          />
        </div>
      </div>

      {transferType === "INTER_BANK" && (
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-ink-900">
            Recipient Bank
          </label>
          <select
            value={recipient.bankCode}
            onChange={(e) => onBankChange(e.target.value)}
            className="h-11 w-full rounded-lg border border-surface-300 bg-white px-3.5 text-sm text-ink-900 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            {BANKS.filter((b) => b.code !== "058").map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-sm font-semibold text-ink-900">Recipient Account</p>
        <label className="mb-1.5 block text-xs font-medium text-ink-500">
          Account Number
        </label>
        <div className="flex gap-2">
          <TextField
            className="flex-1"
            placeholder="Enter account number"
            value={recipient.accountNumber}
            onChange={(e) => onAccountNumberChange(e.target.value)}
          />
          <Button
            type="button"
            variant="accent"
            onClick={onEnquire}
            loading={recipient.enquiryStatus === "loading"}
            className="shrink-0"
          >
            {recipient.enquiryStatus !== "loading" && <Search size={16} />}
            Enquire Name
          </Button>
        </div>

        <div className="mt-2 min-h-[20px] text-sm">
          {recipient.enquiryStatus === "found" && (
            <p className="font-semibold text-success-600">
              {recipient.resolvedName}
              {recipient.resolvedBank ? ` · ${recipient.resolvedBank}` : ""}
            </p>
          )}
          {recipient.enquiryStatus === "error" && (
            <p className="font-medium text-danger-500">{recipient.enquiryError}</p>
          )}
          {recipient.enquiryStatus === "idle" && (
            <p className="text-ink-400">
              Recipient name will appear here after verification
            </p>
          )}
        </div>
      </div>

      <TextField
        label="Amount"
        placeholder="Enter amount"
        value={amount}
        onChange={(e) => onAmountChange(e.target.value)}
        error={amountError}
        suffix={<span className="text-xs font-semibold text-ink-500">NGN</span>}
        hint={!amountError ? `Available balance: ${formatCurrency(balance)}` : undefined}
      />

      <TextField
        label="Narration (Optional)"
        placeholder="Enter narration"
        value={narration}
        onChange={(e) => onNarrationChange(e.target.value)}
      />

      <Button
        size="lg"
        className="w-full"
        disabled={recipient.enquiryStatus !== "found" || !amount}
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  );
}

function TypeOption({ icon: Icon, title, subtitle, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-accent-500 bg-accent-500/5"
          : "border-surface-300 hover:bg-surface-50"
      )}
    >
      <div className="flex w-full items-center justify-between">
        <Icon size={18} className={selected ? "text-accent-500" : "text-ink-400"} />
        {selected && <Check size={16} className="text-accent-500" />}
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-900">{title}</p>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
    </button>
  );
}

function ReviewStep({ transferType, fromAccount, recipient, amount, narration, onBack, onConfirm }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-3 text-sm font-semibold text-ink-900">Review Transfer</p>
        <dl className="divide-y divide-surface-200 rounded-lg border border-surface-200">
          <Row label="Transfer Type" value={transferType === "INTRA_BANK" ? "Intra-bank" : "Inter-bank"} />
          <Row label="From" value={`${fromAccount.accountNumber} · ${fromAccount.accountName}`} />
          <Row
            label="To"
            value={`${recipient.accountNumber} · ${recipient.resolvedName}`}
          />
          {transferType === "INTER_BANK" && (
            <Row label="Recipient Bank" value={recipient.resolvedBank} />
          )}
          <Row label="Amount" value={formatCurrency(amount)} />
          <Row label="Narration" value={narration || "—"} />
        </dl>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" onClick={onConfirm}>
          Confirm &amp; Send
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-right font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

function ConfirmStep({ status, result, error, onViewTransaction, onAnother }) {
  if (status === "processing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <Loader2 size={36} className="animate-spin text-accent-500" />
        <p className="text-sm font-medium text-ink-700">Processing your transfer…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-50">
          <XCircle size={28} className="text-danger-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-ink-900">Transfer Failed</h3>
          <p className="mt-1 text-sm text-ink-500">{error}</p>
        </div>
        <Button className="mt-2 w-full" onClick={onAnother}>
          Try Again
        </Button>
      </div>
    );
  }

  const isPending = result?.status === "PENDING";

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          isPending ? "bg-warning-50" : "bg-success-50"
        )}
      >
        {isPending ? (
          <Clock size={28} className="text-warning-500" />
        ) : (
          <CheckCircle2 size={28} className="text-success-500" />
        )}
      </div>
      <div>
        <h3 className="text-lg font-bold text-ink-900">
          {isPending ? "Transfer Pending" : "Transfer Successful"}
        </h3>
        <p className="mt-1 text-sm text-ink-500">
          {isPending
            ? "Your transfer is being processed by the receiving bank."
            : `${formatCurrency(result.amount)} sent to ${result.toAccountName}.`}
        </p>
        <p className="mt-2 text-xs font-medium text-ink-400">
          Reference: {result.reference}
        </p>
      </div>
      <div className="flex w-full gap-3">
        <Button variant="outline" className="flex-1" onClick={onAnother}>
          New Transfer
        </Button>
        <Button className="flex-1" onClick={onViewTransaction}>
          View Details
        </Button>
      </div>
    </div>
  );
}
