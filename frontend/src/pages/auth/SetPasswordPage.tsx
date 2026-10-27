import { useAuth } from "../../hooks/useAuth";
import { useSocietyName } from "../../hooks/useSocietyName";
import { ChangePasswordForm } from "../../components/ChangePasswordModal";

/** Shown instead of the app while the user holds a temporary or admin-issued password. */
export function SetPasswordPage() {
  const { user, refreshUser, logout } = useAuth();
  const societyName = useSocietyName();

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-tint via-gray-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl shadow-brand/10 ring-1 ring-gray-100 p-8">
        <div className="text-center mb-6">
          <img src="/icons/logo.svg" alt="" className="w-12 h-12 mx-auto mb-3 rounded-2xl shadow-md shadow-brand/30" />
          <h1 className="text-2xl font-bold text-brand-dark tracking-tight">Set your password</h1>
          <p className="text-gray-500 text-sm mt-2">
            Welcome{user ? `, ${user.name}` : ""}. You signed in with a temporary password; choose your own to
            continue{societyName ? ` to ${societyName}` : ""}.
          </p>
        </div>
        <ChangePasswordForm requireCurrent={false} submitLabel="Save and Continue" onDone={refreshUser} />
        <button onClick={logout} className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-4">
          Log out
        </button>
      </div>
    </div>
  );
}
