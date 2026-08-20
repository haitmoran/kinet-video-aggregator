"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  changePassword,
  establishManagerSession,
  MANAGER_USERNAME,
  registerAccount,
  resetPassword,
  signInAccount,
  type SessionUser,
} from "@/lib/localAuth";
import {
  authenticateAnalyticsOwner,
  clearAnalyticsOwnerSession,
  saveAnalyticsOwnerSession,
} from "@/lib/analyticsClient";

export type AuthMode = "login" | "register" | "reset" | "change";

type AuthDialogProps = {
  open: boolean;
  mode: AuthMode;
  currentUser: SessionUser | null;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onAuthenticated: (user: SessionUser) => void;
};

const titles: Record<AuthMode, string> = {
  login: "Welcome back",
  register: "Create your account",
  reset: "Reset your password",
  change: "Change your password",
};

export function AuthDialog({
  open,
  mode,
  currentUser,
  onClose,
  onModeChange,
  onAuthenticated,
}: AuthDialogProps) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUsername(
      mode === "change" || mode === "login" ? currentUser?.username ?? "" : "",
    );
    setEmail("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    window.setTimeout(() => firstInputRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentUser?.username, mode, onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const passwordToConfirm = mode === "login" ? password : mode === "register" ? password : newPassword;
    if (mode !== "login" && passwordToConfirm !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "register") {
        const user = await registerAccount({ username, password, email });
        clearAnalyticsOwnerSession();
        onAuthenticated(user);
        onClose();
      } else if (mode === "login") {
        const normalizedUsername = username.trim().toLowerCase();
        const user = normalizedUsername === MANAGER_USERNAME
          ? await (async () => {
              const analyticsReconnect =
                new URLSearchParams(window.location.search).get("managerLogin") === "1";

              if (!analyticsReconnect) {
                try {
                  const localManager = await signInAccount(username, password);
                  try {
                    const ownerToken = await authenticateAnalyticsOwner(username, password);
                    saveAnalyticsOwnerSession(ownerToken);
                  } catch {
                    clearAnalyticsOwnerSession();
                  }
                  return localManager;
                } catch {
                  // A secure manager login can provision or replace the old local-only account.
                }
              }

              const ownerToken = await authenticateAnalyticsOwner(username, password);
              const manager = await establishManagerSession(username, password);
              saveAnalyticsOwnerSession(ownerToken);
              return manager;
            })()
          : await signInAccount(username, password);
        if (normalizedUsername !== MANAGER_USERNAME) clearAnalyticsOwnerSession();
        onAuthenticated(user);
        onClose();
      } else if (mode === "reset") {
        const user = await resetPassword({ username, email, newPassword });
        onAuthenticated(user);
        onClose();
      } else if (currentUser) {
        await changePassword({
          normalizedUsername: currentUser.normalizedUsername,
          currentPassword: password,
          newPassword,
        });
        onClose();
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const isManagerLogin =
    mode === "login" && username.trim().toLowerCase() === MANAGER_USERNAME;

  return (
    <div className="auth-backdrop" role="presentation" onMouseDown={handleBackdrop}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        aria-describedby="auth-note"
      >
        <button className="auth-dialog__close" type="button" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <div className="auth-dialog__brand" aria-hidden="true">
          <span className="brand__mark"><span /></span>
        </div>
        <p className="auth-dialog__eyebrow">Kinet account</p>
        <h2 id="auth-title">{titles[mode]}</h2>
        <p className="auth-dialog__intro">
          {mode === "register" && "Save videos and stars in one personal collection."}
          {mode === "login" && (isManagerLogin
            ? "One secure sign-in opens your account and private analytics dashboard."
            : "Sign in to love videos and stars, then open your personal collection.")}
          {mode === "reset" && "Use the optional recovery email saved during registration."}
          {mode === "change" && `Update the password for @${currentUser?.username}.`}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode !== "change" && (
            <label>
              <span>Username</span>
              <input
                ref={firstInputRef}
                name="username"
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                minLength={3}
                maxLength={24}
                required
              />
            </label>
          )}

          {(mode === "register" || mode === "reset") && (
            <label>
              <span>
                Recovery email {mode === "register" && <small>Optional</small>}
              </span>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required={mode === "reset"}
              />
            </label>
          )}

          {(mode === "login" || mode === "register" || mode === "change") && (
            <label>
              <span>{mode === "change" ? "Current password" : "Password"}</span>
              <input
                ref={mode === "change" ? firstInputRef : undefined}
                name="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </label>
          )}

          {(mode === "reset" || mode === "change") && (
            <label>
              <span>New password</span>
              <input
                name="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          )}

          {mode !== "login" && (
            <label>
              <span>Confirm password</span>
              <input
                name="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          )}

          {error && <p className="auth-form__error" role="alert">{error}</p>}

          <button className="auth-form__submit" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : titles[mode]}
          </button>
        </form>

        <div className="auth-dialog__links">
          {mode === "login" && (
            <>
              <button type="button" onClick={() => onModeChange("register")}>Create account</button>
              <button type="button" onClick={() => onModeChange("reset")}>Forgot password?</button>
            </>
          )}
          {mode === "register" && (
            <button type="button" onClick={() => onModeChange("login")}>Already registered? Sign in</button>
          )}
          {mode === "reset" && (
            <button type="button" onClick={() => onModeChange("login")}>Back to sign in</button>
          )}
        </div>

        <p className="auth-dialog__note" id="auth-note">
          {isManagerLogin
            ? "The manager credential is verified by the private analytics service; it is never stored in the site bundle."
            : "Static demo: salted password and recovery-email hashes plus likes are stored only in this browser and do not sync between devices."}
        </p>
      </section>
    </div>
  );
}
