"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  Loader2,
  AlertCircle,
  Mail,
  Lock,
  ArrowRight,
} from "lucide-react";

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
        if (password.length < 6) {
          throw new Error(
            "Password must be at least 6 characters."
          );
        }

        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
      } else {
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );
      }

      router.push("/dashboard");
    } catch (e: any) {
      setError(
        friendlyError(e?.code) ||
          e?.message ||
          "Authentication failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* STATUS */}
        <div className="flex items-center gap-2 mb-4 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />

          <span className="text-zinc-500 font-mono uppercase tracking-wider">
            {mode === "signup"
              ? "Account setup"
              : "Authentication"}
          </span>
        </div>

        {/* CARD */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6">

          {/* HEADER */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white tracking-tight">
              {mode === "signup"
                ? "Create admin account"
                : "Log in"}
            </h1>

            <p className="text-sm text-zinc-500 mt-1">
              {mode === "signup"
                ? "Set up the account you'll use to manage this device."
                : "Sign in to access your dashboard."}
            </p>
          </div>

          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            className="space-y-3"
          >

            {/* EMAIL */}
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />

              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="
                  w-full
                  min-h-11
                  bg-black
                  border
                  border-zinc-800
                  rounded-xl
                  pl-10
                  pr-3
                  text-sm
                  text-zinc-200
                  placeholder:text-zinc-600
                  focus:outline-none
                  focus:border-white
                  transition-colors
                "
              />
            </div>

            {/* PASSWORD */}
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />

              <input
                type="password"
                required
                autoComplete={
                  mode === "signup"
                    ? "new-password"
                    : "current-password"
                }
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="
                  w-full
                  min-h-11
                  bg-black
                  border
                  border-zinc-800
                  rounded-xl
                  pl-10
                  pr-3
                  text-sm
                  text-zinc-200
                  placeholder:text-zinc-600
                  focus:outline-none
                  focus:border-white
                  transition-colors
                "
              />
            </div>

            {/* ERROR */}
            {error && (
              <div className="flex items-start gap-2 text-sm text-zinc-300 border border-zinc-800 bg-black rounded-xl p-3">
                <AlertCircle
                  size={16}
                  className="mt-0.5 shrink-0 text-zinc-400"
                />

                <span>
                  {error}
                </span>
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full
                min-h-11
                flex
                items-center
                justify-center
                gap-2
                bg-white
                text-black
                rounded-xl
                font-medium
                text-sm
                disabled:opacity-50
                disabled:cursor-not-allowed
                active:scale-[0.98]
                transition-transform
              "
            >
              {loading && (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              )}

              {mode === "signup"
                ? "Create account"
                : "Log in"}

              {!loading && (
                <ArrowRight size={15} />
              )}
            </button>
          </form>

          {/* SWITCH MODE */}
          <button
            type="button"
            onClick={() => {
              setMode(
                mode === "signup"
                  ? "login"
                  : "signup"
              );

              setError("");
            }}
            className="
              w-full
              flex
              items-center
              justify-center
              gap-1
              text-center
              text-xs
              text-zinc-500
              hover:text-white
              transition-colors
              mt-5
            "
          >
            {mode === "signup"
              ? "Already have an account?"
              : "Need an account?"}

            <span className="text-zinc-300">
              {mode === "signup"
                ? "Log in"
                : "Sign up"}
            </span>
          </button>
        </div>

        {/* FOOTER */}
        <p className="text-center text-xs text-zinc-700 font-mono mt-4">
          ESP32 · Account setup
        </p>
      </div>
    </div>
  );
}

function friendlyError(code?: string) {
  const map: Record<string, string> = {
    "auth/email-already-in-use":
      "An account with this email already exists.",

    "auth/invalid-email":
      "Enter a valid email address.",

    "auth/weak-password":
      "Password must be at least 6 characters.",

    "auth/user-not-found":
      "No account found with this email.",

    "auth/wrong-password":
      "Incorrect password.",

    "auth/invalid-credential":
      "Incorrect email or password.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",
  };

  return code ? map[code] : undefined;
}