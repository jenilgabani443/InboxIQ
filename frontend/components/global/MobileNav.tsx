"use client";

import * as React from "react";
import { Menu, Inbox } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SIDEBAR_NAV_ITEMS } from "./Sidebar";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  return (
    <div className="flex md:hidden items-center p-4 border-b bg-background">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Navigate around the app</SheetDescription>
          <div className="flex h-14 items-center border-b px-6">
            <Link 
              href="/" 
              className="flex items-center gap-2 font-semibold"
              onClick={() => setOpen(false)}
            >
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
                    onClick={() => setOpen(false)}
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
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center gap-2 font-semibold ml-4">
        <span className="text-lg tracking-tight">InboxIQ</span>
      </Link>
    </div>
  );
}
