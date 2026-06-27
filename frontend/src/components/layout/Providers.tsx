"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AuthGuard } from "./AuthGuard";
import { Navbar } from "./Navbar";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </AuthGuard>
    </QueryClientProvider>
  );
}
