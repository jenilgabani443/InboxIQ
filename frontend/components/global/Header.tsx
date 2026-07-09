"use client";

import * as React from "react";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { UserMenu } from "./UserMenu";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
      <div className="w-full flex-1 flex items-center justify-center lg:justify-start">
        <SearchBar />
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="text-muted-foreground relative">
          <Bell className="h-5 w-5" />
          {/* Mock notification badge */}
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-primary" />
          <span className="sr-only">Notifications</span>
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
