"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
      if (!u) router.push("/auth");
    });
    return () => unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-cyan-400" size={24} />
      </div>
    );
  }

  if (!user) return null;

  return <div className="min-h-dvh bg-slate-950">{children}</div>;
}