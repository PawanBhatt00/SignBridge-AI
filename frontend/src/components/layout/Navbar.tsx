"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Database,
  Hand,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/translator", label: "Translator", icon: Hand },
  { href: "/dataset", label: "Dataset", icon: Database },
  { href: "/profile", label: "Profile", icon: User },
];

export function Navbar() {
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (isAuthPage) return null;

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/10">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Hand className="h-7 w-7 text-primary" aria-hidden="true" />
          <span className="text-xl font-bold gradient-text">SignBridge AI</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
          {isAuthenticated &&
            navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-muted-foreground">{user?.name}</span>
              <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Get Started</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="md:hidden border-t border-white/10 p-4 space-y-2" aria-label="Mobile navigation">
          {isAuthenticated ? (
            <>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-2 rounded-lg hover:bg-white/5"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                className="w-full text-left px-4 py-2 rounded-lg hover:bg-white/5 text-destructive"
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="block px-4 py-2" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
              <Link href="/register" className="block px-4 py-2" onClick={() => setMobileOpen(false)}>
                Register
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
