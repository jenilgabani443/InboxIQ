"use client";

import * as React from "react";
import { ThemeToggle } from "./ThemeToggle";
import { SearchBar } from "./SearchBar";
import { UserMenu } from "./UserMenu";
import { NotificationDropdown } from "./NotificationDropdown";

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
      <div className="w-full flex-1 flex items-center justify-center lg:justify-start">
        <SearchBar />
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        <NotificationDropdown />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
