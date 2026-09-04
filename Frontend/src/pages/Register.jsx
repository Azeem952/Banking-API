import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import AuthLayout from "../components/layout/AuthLayout";
import TextField from "../components/ui/TextField";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  email: "",
  password: "",
  confirmPassword: "",
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Password must be at least 8 characters long.";
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    if (!validate()) return;

    setLoading(true);
    try {
      await register(form);
      navigate("/login", { state: { justRegistered: true } });
    } catch (err) {
      setServerError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      eyebrow={
        <>
          Banking built for <span className="text-accent-500">you</span>
        </>
      }
      description="Create your account and experience secure, reliable and seamless banking."
      title="Create Account"
      footerNote="Fill in your details below to get started."
    >
      {serverError && (
        <Alert type="error" className="mb-6">
          {serverError}
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
          error={errors.email}
          autoComplete="email"
        />
        <TextField
          label="Password"
          icon={Lock}
          type="password"
          placeholder="Create a strong password"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          error={errors.password}
          hint={!errors.password ? "Password must be at least 8 characters long." : undefined}
          autoComplete="new-password"
        />
        <TextField
          label="Confirm Password"
          icon={Lock}
          type="password"
          placeholder="Confirm your password"
          value={form.confirmPassword}
          onChange={(e) => update("confirmPassword", e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
          {loading ? "Creating Account..." : "Create Account"}
        </Button>

        <div className="relative my-1 text-center">
          <span className="relative z-10 bg-white px-3 text-sm text-ink-500">
            Already have an account?
          </span>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-surface-200" />
        </div>

        <Link
          to="/login"
          className="text-center text-sm font-semibold text-accent-500 hover:text-accent-600"
        >
          Log in
        </Link>
      </form>
    </AuthLayout>
  );
}
