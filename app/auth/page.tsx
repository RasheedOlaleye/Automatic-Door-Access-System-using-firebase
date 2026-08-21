"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2, AlertCircle, Mail, Lock } from "lucide-react";

type Mode = "signup" | "login";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.push("/dashboard");
    } catch (e: any) {
      setError(friendlyError(e.code) || e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6">
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            {mode === "signup" ? "Create admin account" : "Log in"}
          </h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            {mode === "signup"
              ? "Set up the account you'll use to manage this device."
              : "Sign in to access your dashboard."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-11 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-11 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>

            {error && (
              <p className="flex items-start gap-2 text-sm text-rose-400">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-11 flex items-center justify-center gap-2 bg-cyan-400 text-slate-950 rounded-xl font-medium text-sm disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
            }}
            className="w-full text-center text-xs text-slate-500 mt-4"
          >
            {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}

function friendlyError(code: string) {
  const map: Record<string, string> = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
  };
  return map[code];
}