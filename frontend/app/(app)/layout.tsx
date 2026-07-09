import * as React from "react";
import { Sidebar } from "@/components/global/Sidebar";
import { Header } from "@/components/global/Header";
import { MobileNav } from "@/components/global/MobileNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex flex-col flex-1 w-full">
        <MobileNav />
        <Header />
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
