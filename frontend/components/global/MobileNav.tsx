"use client";

import * as React from "react";
import { Menu, Inbox, Tag } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SIDEBAR_NAV_ITEMS } from "./Sidebar";
import { cn } from "@/lib/utils";
import { useEmailStore } from "@/store/emailStore";
import { useSettingsStore } from "@/store/settingsStore";
import { PenSquare } from "lucide-react";
import { toast } from "sonner";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const { currentFolder, currentLabelId, setCurrentFolder, setComposeOpen, labels, setCurrentLabel } = useEmailStore();
  const { setSettingsOpen } = useSettingsStore();

  return (
    <div className="flex md:hidden items-center p-4 border-b bg-background">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Toggle Menu" title="Menu" />}>
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
            <div className="px-4 mb-4">
              <Button 
                className="w-full justify-start gap-2 h-10" 
                onClick={() => {
                  setComposeOpen(true);
                  setOpen(false);
                }}
              >
                <PenSquare className="h-4 w-4" />
                Compose
              </Button>
            </div>
            <nav className="grid gap-1 px-4 text-sm font-medium">
              {SIDEBAR_NAV_ITEMS.map((item) => {
                const isActive = currentFolder === item.id;
                return (
                  <button
                    key={item.title}
                    onClick={() => {
                      if (item.id === "settings") {
                        setSettingsOpen(true);
                      } else if (item.id === "starred") {
                        toast.info("Backend limitation: Starred retrieval unavailable.");
                      } else if (item.id === "snoozed") {
                        toast.info("Backend limitation: Snoozed retrieval unavailable.");
                      } else if (["inbox", "sent", "archive", "trash", "drafts"].includes(item.id as string)) {
                        setCurrentFolder(item.id as "inbox" | "sent" | "archive" | "trash" | "drafts");
                      }
                      setOpen(false);
                    }}
                    className={cn(
                      buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }),
                      "justify-start gap-3 w-full",
                      isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </button>
                );
              })}
            </nav>
            
            {labels.length > 0 && (
              <div className="mt-4">
                <h4 className="mb-1 px-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Labels
                </h4>
                <nav className="grid gap-1 px-4 text-sm font-medium">
                  {labels.map((label) => {
                    const isActive = currentFolder === "label" && currentLabelId === label._id;
                    return (
                      <button
                        key={label._id}
                        onClick={() => {
                          setCurrentLabel(label._id);
                          setOpen(false);
                        }}
                        className={cn(
                          buttonVariants({ variant: isActive ? "secondary" : "ghost", size: "sm" }),
                          "justify-start gap-3 w-full",
                          isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Tag className="h-4 w-4" style={{ color: label.color }} />
                        {label.name}
                      </button>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Link href="/" className="flex items-center gap-2 font-semibold ml-4">
        <span className="text-lg tracking-tight">InboxIQ</span>
      </Link>
    </div>
  );
}
