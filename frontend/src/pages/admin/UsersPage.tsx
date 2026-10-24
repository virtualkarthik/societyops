import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";
import { getUsers, createUser, updateUser, resetUserPassword, apiErrorMessage } from "../../api/users";
import type { User, UserRole, UserWithPassword } from "../../api/types";

const ROLES: UserRole[] = ["super_admin", "committee", "operator", "resident"];

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Admin",
  committee: "Committee",
  operator: "Operator",
  resident: "Resident",
};

const ROLE_HELP: Record<UserRole, string> = {
  super_admin: "Full access, including managing users",
  committee: "Dashboard, compliance, reports and all logs",
  operator: "Daily STP / water / DG / PPM / housekeeping logs",
  resident: "Can raise and track complaints",
};

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: "bg-purple-100 text-purple-700",
  committee: "bg-blue-100 text-blue-700",
  operator: "bg-amber-100 text-amber-700",
  resident: "bg-gray-100 text-gray-700",
};

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-4 flex justify-between items-center">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-800">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

function RolePicker({ value, onChange }: { value: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
      <div className="grid grid-cols-2 gap-2">
        {ROLES.map((r) => (
          <button key={r} type="button" onClick={() => onChange(r)}
            className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${value === r ? ROLE_COLORS[r] + " border-current" : "bg-white text-gray-500 border-gray-200"}`}>
            {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">{ROLE_HELP[value]}</p>
    </div>
  );
}

function PasswordReveal({ result, heading, onClose }: { result: UserWithPassword; heading: string; onClose: () => void }) {
  const copy = () => {
    navigator.clipboard?.writeText(`Login: ${window.location.origin}\nEmail: ${result.user.email}\nPassword: ${result.temporary_password}`)
      .then(() => toast.success("Copied"), () => toast.error("Copy failed — select and copy manually"));
  };
  return (
    <Modal title={heading} subtitle={result.user.name} onClose={onClose}>
      <p className="text-sm text-gray-600">
        Share these login details with <span className="font-medium">{result.user.name}</span>.
        This password is shown <span className="font-semibold">only once</span>; they can change it after logging in.
      </p>
      <div className="bg-gray-50 border rounded-lg p-3 text-sm space-y-1 font-mono break-all select-all">
        <div><span className="text-gray-500">Email: </span>{result.user.email}</div>
        <div><span className="text-gray-500">Password: </span>{result.temporary_password}</div>
      </div>
      <div className="flex gap-2">
        <button onClick={copy} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl text-base hover:bg-gray-50">
          Copy
        </button>
        <button onClick={onClose} className="flex-1 bg-brand text-white font-semibold py-3 rounded-xl text-base">
          Done
        </button>
      </div>
    </Modal>
  );
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: UserWithPassword) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "operator" as UserRole });

  const mutation = useMutation({
    mutationFn: () => createUser({
      name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() || null, role: form.role,
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onCreated(result);
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to add user")),
  });

  const valid = form.name.trim() && form.email.includes("@");

  return (
    <Modal title="Add User" onClose={onClose}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2.5 text-base" autoFocus />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
        <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2.5 text-base" autoCapitalize="none" />
        <p className="text-xs text-gray-500 mt-1">Used to log in.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2.5 text-base" />
      </div>
      <RolePicker value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} />
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !valid}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base disabled:opacity-60">
        {mutation.isPending ? "Adding…" : "Add User"}
      </button>
    </Modal>
  );
}

function EditUserModal({ user, isSelf, onClose, onPasswordReset }: {
  user: User; isSelf: boolean; onClose: () => void; onPasswordReset: (r: UserWithPassword) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: user.name, phone: user.phone ?? "", role: user.role });
  const [confirmReset, setConfirmReset] = useState(false);

  const save = useMutation({
    mutationFn: () => updateUser(user.id, { name: form.name.trim(), phone: form.phone.trim() || null, role: form.role }),
    onSuccess: () => {
      toast.success("User updated");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to update user")),
  });

  const toggleActive = useMutation({
    mutationFn: () => updateUser(user.id, { is_active: !user.is_active }),
    onSuccess: () => {
      toast.success(user.is_active ? "User deactivated" : "User reactivated");
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to update user")),
  });

  const reset = useMutation({
    mutationFn: () => resetUserPassword(user.id),
    onSuccess: onPasswordReset,
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to reset password")),
  });

  return (
    <Modal title="Edit User" subtitle={user.email} onClose={onClose}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2.5 text-base" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2.5 text-base" />
      </div>
      {isSelf ? (
        <p className="text-xs text-gray-500">You can't change your own role or deactivate yourself.</p>
      ) : (
        <RolePicker value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))} />
      )}
      <button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base disabled:opacity-60">
        {save.isPending ? "Saving…" : "Save Changes"}
      </button>

      {!isSelf && (
        <div className="border-t pt-4 space-y-2">
          {confirmReset ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-amber-800">Their current password will stop working. Continue?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmReset(false)} className="flex-1 border bg-white text-gray-700 text-sm font-medium py-2 rounded-lg">
                  Cancel
                </button>
                <button onClick={() => reset.mutate()} disabled={reset.isPending}
                  className="flex-1 bg-amber-600 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-60">
                  {reset.isPending ? "Resetting…" : "Reset Password"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)}
              className="w-full border border-gray-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50">
              Reset Password
            </button>
          )}
          <button onClick={() => toggleActive.mutate()} disabled={toggleActive.isPending}
            className={`w-full font-medium py-2.5 rounded-xl text-sm border disabled:opacity-60 ${user.is_active ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}>
            {user.is_active ? "Deactivate (blocks login)" : "Reactivate"}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [reveal, setReveal] = useState<{ result: UserWithPassword; heading: string } | null>(null);
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: getUsers,
    enabled: me?.role === "super_admin",
  });

  if (me && me.role !== "super_admin") return <Navigate to="/" replace />;

  const filtered = roleFilter === "ALL" ? users : users.filter((u) => u.role === roleFilter);
  const countFor = (r: UserRole) => users.filter((u) => u.role === r && u.is_active).length;

  return (
    <div className="max-w-3xl mx-auto">
      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)}
          onCreated={(result) => { setShowAdd(false); setReveal({ result, heading: "User Added" }); }} />
      )}
      {editTarget && (
        <EditUserModal user={editTarget} isSelf={editTarget.id === me?.id} onClose={() => setEditTarget(null)}
          onPasswordReset={(result) => { setEditTarget(null); setReveal({ result, heading: "Password Reset" }); }} />
      )}
      {reveal && <PasswordReveal result={reveal.result} heading={reveal.heading} onClose={() => setReveal(null)} />}

      <div className="flex justify-between items-center mb-6 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Who can log in, and what they can do</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="bg-brand text-white px-5 py-2.5 rounded-lg font-medium text-sm min-h-[44px] hover:bg-brand-dark shrink-0">
          + Add User
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setRoleFilter("ALL")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${roleFilter === "ALL" ? "bg-brand text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}>
          All ({users.length})
        </button>
        {ROLES.map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${roleFilter === r ? "bg-brand text-white" : "bg-white text-gray-600 border hover:bg-gray-50"}`}>
            {ROLE_LABELS[r]} ({countFor(r)})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading && <div className="text-center text-gray-400 py-12 text-sm">Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center text-gray-400 py-12 text-sm">No users in this group yet.</div>
        )}
        <div className="divide-y divide-gray-100">
          {filtered.map((u) => (
            <div key={u.id} className={`px-5 py-4 flex items-center justify-between gap-3 ${u.is_active ? "" : "opacity-60"}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="font-medium text-gray-800">{u.name}</span>
                  {u.id === me?.id && <span className="text-xs text-gray-400">(you)</span>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  {!u.is_active && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Inactive</span>}
                </div>
                <p className="text-sm text-gray-500 truncate">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
              </div>
              <button onClick={() => setEditTarget(u)}
                className="shrink-0 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-50">
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
