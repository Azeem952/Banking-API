import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Fingerprint, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import Logo from "../components/ui/Logo";
import Button from "../components/ui/Button";
import TextField from "../components/ui/TextField";
import Alert from "../components/ui/Alert";
import { cn } from "../lib/format";
import { useAuth } from "../context/AuthContext";
import { submitVerification } from "../api/onboardingApi";

const STEPS = [
  { id: 1, title: "Identity Verification", desc: "BVN or NIN" },
  { id: 2, title: "Verification", desc: "We verify your details" },
  { id: 3, title: "Complete", desc: "Account creation unlocked" },
];

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();

  const [method, setMethod] = useState("BVN");
  const [idNumber, setIdNumber] = useState("");
  const [status, setStatus] = useState("idle"); // idle | verifying | success | failed
  const [error, setError] = useState("");

  const activeStep = status === "success" ? 3 : status === "verifying" ? 2 : 1;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!/^\d{11}$/.test(idNumber)) {
      setError(`Enter a valid 11-digit ${method}.`);
      return;
    }

    setStatus("verifying");
    try {
      await submitVerification({ method, idNumber });
      setStatus("success");
      refresh();
      setTimeout(() => navigate("/account", { replace: true }), 1200);
    } catch (err) {
      setStatus("failed");
      setError(err.message || "Verification failed. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-surface-50">
      {/* Left stepper panel */}
      <aside className="hidden w-[360px] shrink-0 flex-col justify-between bg-navy-900 px-10 py-10 lg:flex">
        <div>
          <Logo variant="light" />
          <ol className="mt-14 flex flex-col">
            {STEPS.map((step, idx) => {
              const isDone = activeStep > step.id || (activeStep === 3 && step.id <= 3);
              const isActive = activeStep === step.id && !isDone;
              return (
                <li key={step.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        isDone || isActive
                          ? "bg-accent-500 text-white"
                          : "bg-white/10 text-white/50"
                      )}
                    >
                      {isDone ? <CheckCircle2 size={16} /> : step.id}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className="my-1 h-12 w-px bg-white/15" />
                    )}
                  </div>
                  <div className="pb-8">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        isDone || isActive ? "text-white" : "text-white/50"
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs text-white/50">{step.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent-500" />
          <p className="text-[13px] leading-relaxed text-white/70">
            Your information is secure and protected with the highest standards.
          </p>
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <Logo variant="dark" />
          </div>
          <h2 className="text-[28px] font-bold leading-tight text-ink-900">
            Customer Onboarding
          </h2>
          <p className="mt-1.5 text-sm text-ink-500">
            Verify your identity to continue
          </p>

          <div className="mt-8">
            {status === "success" ? (
              <Alert type="success">
                Verification successful. Redirecting you to account creation…
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
                {error && <Alert type="error">{error}</Alert>}

                <div>
                  <p className="mb-3 text-sm font-semibold text-ink-900">
                    Select Verification Type
                  </p>
                  <p className="mb-3 text-sm text-ink-500">
                    Choose the type of identification you want to use.
                  </p>
                  <div className="flex flex-col gap-3">
                    <VerificationOption
                      icon={CreditCard}
                      title="BVN Verification"
                      description="Verify using your Bank Verification Number"
                      selected={method === "BVN"}
                      onClick={() => {
                        setMethod("BVN");
                        setIdNumber("");
                        setError("");
                      }}
                    />
                    <VerificationOption
                      icon={Fingerprint}
                      title="NIN Verification"
                      description="Verify using your National Identification Number"
                      selected={method === "NIN"}
                      onClick={() => {
                        setMethod("NIN");
                        setIdNumber("");
                        setError("");
                      }}
                    />
                  </div>
                </div>

                <TextField
                  label={method}
                  placeholder={`Enter your ${method}`}
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
                  hint={`Enter your 11-digit ${method}`}
                  icon={ShieldCheck}
                  disabled={status === "verifying"}
                />

                <Alert type="info">
                  Make sure your {method} is correct. You can only create an account
                  after successful verification.
                </Alert>

                <Button
                  type="submit"
                  size="lg"
                  loading={status === "verifying"}
                  className="w-full"
                >
                  {status === "verifying" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  disabled={status === "verifying"}
                  className="text-center text-sm font-semibold text-accent-500 hover:text-accent-600 disabled:opacity-50"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function VerificationOption({ icon: Icon, title, description, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border px-4 py-3.5 text-left transition-colors",
        selected
          ? "border-accent-500 bg-accent-500/5"
          : "border-surface-300 hover:border-surface-300 hover:bg-surface-50"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-accent-500" : "border-surface-300"
          )}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-accent-500" />}
        </span>
        <div>
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          <p className="mt-0.5 text-xs text-ink-500">{description}</p>
        </div>
      </div>
      <Icon size={20} className={selected ? "text-accent-500" : "text-ink-400"} />
    </button>
  );
}
