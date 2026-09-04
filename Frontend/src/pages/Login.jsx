import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import AuthLayout from "../components/layout/AuthLayout";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = location.state?.justRegistered;

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { onboarding, account } = await login(form);
      if (onboarding.status !== "VERIFIED") {
        navigate("/onboarding", { replace: true });
      } else if (!account) {
        navigate("/account", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Unable to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome Back"
      description="Log in to your account to access your banking services securely."
      title="Log In"
      footerNote="Enter your credentials to continue"
    >
      {justRegistered && (
        <Alert type="success" className="mb-6">
          Registration successful. Log in to continue.
        </Alert>
      )}
      {error && (
        <Alert type="error" className="mb-6">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Email Address"
          icon={Mail}
          type="email"
          placeholder="Enter your email address"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          autoComplete="email"
          required
        />
        <div>
          <TextField
            label="Password"
            icon={Lock}
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            autoComplete="current-password"
            required
          />
          <div className="mt-2 text-right">
            <button
              type="button"
              className="text-sm font-semibold text-accent-500 hover:text-accent-600"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          {loading ? "Logging In..." : "Log In"}
        </Button>

        <div className="relative my-1 text-center">
          <span className="relative z-10 bg-white px-3 text-sm text-ink-500">or</span>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-surface-200" />
        </div>

        <p className="text-center text-sm text-ink-500">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-accent-500 hover:text-accent-600">
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
