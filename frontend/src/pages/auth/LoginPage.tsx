import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { login, forgotPassword } from "../../api/auth";
import { useAuth } from "../../hooks/useAuth";
import { useSocietyName } from "../../hooks/useSocietyName";

export function LoginPage() {
  const { t } = useTranslation();
  const { setToken } = useAuth();
  const navigate = useNavigate();
  const societyName = useSocietyName();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [forgotSent, setForgotSent] = useState<string | null>(null);

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      setForgotSent(await forgotPassword(identifier));
    } catch {
      toast.error("Couldn't send right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const backToLogin = () => {
    setMode("login");
    setForgotSent(null);
    setPassword("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = await login(identifier, password);
      setToken(token);
      navigate("/"); // DefaultRedirect picks the landing page for this role
    } catch {
      toast.error("Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-tint via-gray-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-brand/10 ring-1 ring-gray-100 p-8">
        <div className="text-center mb-8">
          <img src="/icons/logo.svg" alt="" className="w-14 h-14 mx-auto mb-3 rounded-2xl shadow-md shadow-brand/30" />
          {societyName ? (
            <>
              <h1 className="text-3xl font-bold text-brand-dark tracking-tight">{societyName}</h1>
              <p className="text-gray-500 text-sm mt-1">{t("app.tagline")}</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-brand-dark tracking-tight">SocietyOps</h1>
              <p className="text-gray-500 text-sm mt-1">{t("app.tagline")}</p>
            </>
          )}
        </div>
        {mode === "forgot" ? (
          forgotSent ? (
            <div className="space-y-4">
              <div className="bg-brand-tint border border-brand-light rounded-xl p-4 text-sm text-gray-700">{forgotSent}</div>
              <p className="text-xs text-gray-500">
                The temporary password works for 30 minutes and you'll choose a new one right after logging in.
                Your current password keeps working until then.
              </p>
              <button onClick={backToLogin}
                className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base hover:bg-brand-dark">
                {t("auth.back_to_login")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-gray-600">{t("auth.forgot_help")}</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.email_or_phone")}</label>
                <input type="text" required autoComplete="username" autoCapitalize="none" autoFocus
                  value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base"
                  placeholder={t("auth.email_or_phone_placeholder")} />
              </div>
              <button type="submit" disabled={loading || !identifier.trim()}
                className="w-full bg-brand text-white font-semibold py-3 rounded-xl shadow-sm shadow-brand/30 text-base hover:bg-brand-dark disabled:opacity-60">
                {loading ? t("auth.sending") : t("auth.send_temp_password")}
              </button>
              <button type="button" onClick={backToLogin} className="w-full text-sm text-gray-500 hover:text-gray-700">
                {t("auth.back_to_login")}
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.email_or_phone")}</label>
              <input
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand"
                placeholder={t("auth.email_or_phone_placeholder")}
              />
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">{t("auth.password")}</label>
                <button type="button" onClick={() => setMode("forgot")}
                  className="text-xs font-medium text-brand hover:text-brand-dark min-h-0">
                  {t("auth.forgot_password")}
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand/60 focus:border-brand"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand text-white font-semibold py-3 rounded-xl shadow-sm shadow-brand/30 text-base min-h-[44px] hover:bg-brand-dark disabled:opacity-60 transition-colors"
            >
              {loading ? t("auth.signing_in") : t("auth.login")}
            </button>
          </form>
        )}
        <p className="text-center text-xs text-gray-400 mt-6">
          {societyName ? <>Powered by <span className="font-semibold text-brand">SocietyOps</span></> : t("app.tagline")}
        </p>
      </div>
    </div>
  );
}
