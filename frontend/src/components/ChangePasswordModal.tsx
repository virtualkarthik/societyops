import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { changeOwnPassword, apiErrorMessage } from "../api/users";

const MIN_LENGTH = 8;

/** New-password form. `requireCurrent` is false when the user just signed in with a temporary password. */
export function ChangePasswordForm({ requireCurrent, submitLabel, onDone }: {
  requireCurrent: boolean; submitLabel: string; onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: () => changeOwnPassword(requireCurrent ? current : null, next),
    onSuccess: () => {
      toast.success("Password changed");
      onDone();
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Failed to change password")),
  });

  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = (!requireCurrent || current) && next.length >= MIN_LENGTH && next === confirm;

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }}>
      {requireCurrent && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password"
            className="w-full border rounded-lg px-3 py-2.5 text-base" autoFocus />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password"
          className="w-full border rounded-lg px-3 py-2.5 text-base" autoFocus={!requireCurrent} />
        <p className="text-xs text-gray-500 mt-1">At least {MIN_LENGTH} characters.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
          className="w-full border rounded-lg px-3 py-2.5 text-base" />
        {mismatch && <p className="text-xs text-red-600 mt-1">Passwords don't match.</p>}
      </div>
      <button type="submit" disabled={mutation.isPending || !valid}
        className="w-full bg-brand text-white font-semibold py-3 rounded-xl text-base disabled:opacity-60">
        {mutation.isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl text-gray-800" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-4 flex justify-between items-center">
          <h2 className="font-semibold">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5">
          <ChangePasswordForm requireCurrent submitLabel="Change Password" onDone={onClose} />
        </div>
      </div>
    </div>
  );
}
