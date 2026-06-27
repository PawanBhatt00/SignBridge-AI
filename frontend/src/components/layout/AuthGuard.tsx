"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const protectedRoutes = ["/dashboard", "/translator", "/dataset", "/profile"];
const authRoutes = ["/login", "/register"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));
    const isAuth = authRoutes.includes(pathname);

    if (isProtected && !isAuthenticated) {
      router.replace("/login");
    } else if (isAuth && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, pathname, router]);

  return <>{children}</>;
}
