import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/layout/AppLayout";

/**
 * requireVerified - if true, redirects to /onboarding unless onboarding is VERIFIED
 * requireAccount  - if true, redirects to /account unless an account already exists
 *
 * These mirror the backend business rules:
 *   - Account creation cannot happen until onboarding succeeds.
 *   - Banking operations (dashboard, transfer, transactions) require an account.
 */
export default function ProtectedRoute({
  children,
  requireVerified = false,
  requireAccount = false,
}) {
  const { isAuthenticated, onboarding, account } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireVerified && onboarding?.status !== "VERIFIED") {
    return <Navigate to="/onboarding" replace />;
  }

  if (requireAccount && !account) {
    return <Navigate to="/account" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}
