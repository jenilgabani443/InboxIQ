"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Define routes that are part of the auth flow
    const isAuthRoute =
      pathname.startsWith("/login") ||
      pathname.startsWith("/register") ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password") ||
      pathname.startsWith("/mfa");

    // If unauthenticated and not on an auth route, redirect to login
    if (!isAuthenticated && !isAuthRoute) {
      router.replace(`/login?returnUrl=${encodeURIComponent(pathname)}`);
    }

    // If authenticated and on an auth route, redirect to dashboard
    if (isAuthenticated && isAuthRoute) {
      router.replace("/");
    }
  }, [isAuthenticated, pathname, router, mounted]);

  // Show nothing while hydration is happening to prevent hydration mismatch and flashes
  if (!mounted) {
    return null;
  }

  return <>{children}</>;
}
