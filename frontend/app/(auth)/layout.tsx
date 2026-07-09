import * as React from "react";
import { ThemeToggle } from "@/components/global/ThemeToggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">InboxIQ</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered email collaboration platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
