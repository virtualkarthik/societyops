import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";
import { OnlineIndicator } from "./OnlineIndicator";

const navItems = [
  { to: "/dashboard", key: "nav.dashboard", roles: ["super_admin", "committee"] },
  { to: "/assets", key: "nav.assets", roles: ["super_admin", "committee", "operator"] },
  { to: "/operator/stp", key: "nav.stp", roles: ["super_admin", "committee", "operator"] },
  { to: "/operator/water", key: "nav.water", roles: ["super_admin", "committee", "operator"] },
  { to: "/operator/dg", key: "nav.dg", roles: ["super_admin", "committee", "operator"] },
  { to: "/operator/ppm", key: "nav.ppm", roles: ["super_admin", "committee", "operator"] },
  { to: "/operator/service", key: "nav.service", roles: ["super_admin", "committee", "operator"] },
  { to: "/compliance", key: "nav.compliance", roles: ["super_admin", "committee"] },
  { to: "/inventory", key: "nav.inventory", roles: ["super_admin", "committee", "operator"] },
  { to: "/complaints", key: "nav.complaints", roles: ["super_admin", "committee", "operator", "resident"] },
  { to: "/reports", key: "nav.reports", roles: ["super_admin", "committee"] },
];

export function Layout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filteredNav = navItems.filter((item) => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-brand text-white shadow-md z-20 sticky top-0">
        <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-xl font-bold tracking-tight">SocietyOps</span>
          </div>
          <div className="flex items-center gap-4">
            <OnlineIndicator />
            <button
              onClick={() => {
                const newLang = i18n.language === "en" ? "ta" : "en";
                i18n.changeLanguage(newLang);
                localStorage.setItem("lang", newLang);
              }}
              className="text-xs bg-white/20 rounded px-2 py-1 hover:bg-white/30"
            >
              {i18n.language === "en" ? "தமிழ்" : "English"}
            </button>
            <span className="hidden md:block text-sm opacity-80">{user?.name}</span>
            <button onClick={handleLogout} className="text-sm bg-white/20 rounded px-2 py-1 hover:bg-white/30">
              {t("nav.logout")}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar — hidden on mobile unless toggled */}
        <aside
          className={`${
            open ? "block" : "hidden"
          } md:block w-56 bg-white border-r border-gray-200 shrink-0 z-10`}
        >
          <nav className="p-3 space-y-1">
            {filteredNav.map(({ to, key }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive ? "bg-brand text-white" : "text-gray-700 hover:bg-gray-100"
                  }`
                }
              >
                {t(key)}
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
