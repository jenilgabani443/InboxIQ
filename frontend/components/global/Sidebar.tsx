"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Star,
  Send,
  File,
  Clock,
  Archive,
  Trash2,
  Tag,
  Settings,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const SIDEBAR_NAV_ITEMS = [
  {
    title: "Inbox",
    href: "/",
    icon: Inbox,
  },
  {
    title: "Starred",
    href: "/starred",
    icon: Star,
  },
  {
    title: "Snoozed",
    href: "/snoozed",
    icon: Clock,
  },
  {
    title: "Sent",
    href: "/sent",
    icon: Send,
  },
  {
    title: "Drafts",
    href: "/drafts",
    icon: File,
  },
  {
    title: "Archive",
    href: "/archive",
    icon: Archive,
  },
  {
    title: "Trash",
    href: "/trash",
    icon: Trash2,
  },
  {
    title: "Labels",
    href: "/labels",
    icon: Tag,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/40 md:flex">
      <div className="flex h-14 items-center border-b px-6 lg:h-[60px]">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Inbox className="h-6 w-6 text-primary" />
          <span className="text-xl tracking-tight">InboxIQ</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-4 text-sm font-medium">
          {SIDEBAR_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.title}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }),
                  "justify-start gap-3",
                  isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
