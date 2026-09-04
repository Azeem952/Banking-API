import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";

import Register from "./pages/Register";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Account from "./pages/Account";
import Dashboard from "./pages/Dashboard";
import Transfer from "./pages/Transfer";
import Transactions from "./pages/Transactions";
import TransactionDetail from "./pages/TransactionDetail";

function RootRedirect() {
  const { isAuthenticated, onboarding, account } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (onboarding?.status !== "VERIFIED") return <Navigate to="/onboarding" replace />;
  if (!account) return <Navigate to="/account" replace />;
  return <Navigate to="/dashboard" replace />;
}

// Onboarding only requires being logged in — it must be reachable regardless
// of current onboarding status (that's the page that changes the status).
function RequireAuthOnly({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/onboarding"
            element={
              <RequireAuthOnly>
                <Onboarding />
              </RequireAuthOnly>
            }
          />

          <Route
            path="/account"
            element={
              <ProtectedRoute requireVerified>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireVerified requireAccount>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transfer"
            element={
              <ProtectedRoute requireVerified requireAccount>
                <Transfer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute requireVerified requireAccount>
                <Transactions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions/:reference"
            element={
              <ProtectedRoute requireVerified requireAccount>
                <TransactionDetail />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
