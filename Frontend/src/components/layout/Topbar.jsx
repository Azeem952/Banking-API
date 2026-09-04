import { useState } from "react";
import { Bell, ChevronDown, Menu, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Topbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const initials = (user?.email || "U")
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-surface-200 bg-white px-4 sm:px-8">
      <button
        onClick={onMenuClick}
        className="rounded-lg p-2 text-ink-700 hover:bg-surface-100 lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-4">
        <button
          className="relative rounded-full p-2 text-ink-500 hover:bg-surface-100"
          aria-label="Notifications"
        >
          <Bell size={19} />
        </button>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2.5 hover:bg-surface-100"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
              {initials}
            </span>
            <span className="hidden text-sm font-medium text-ink-900 sm:block">
              {user?.email}
            </span>
            <ChevronDown size={16} className="text-ink-400" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-surface-200 bg-white py-1.5 shadow-panel">
                <div className="border-b border-surface-200 px-3.5 py-2.5">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    {user?.email}
                  </p>
                  <p className="truncate text-xs text-ink-500">Customer Account</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-danger-500 hover:bg-surface-50"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
