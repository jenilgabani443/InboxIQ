"use client";

import * as React from "react";
import Link from "next/link";
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
  PenSquare,
  Bookmark,
  MoreVertical,
  Edit2
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEmailStore } from "@/store/emailStore";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const SIDEBAR_NAV_ITEMS = [
  {
    title: "Inbox",
    id: "inbox",
    icon: Inbox,
  },
  {
    title: "Starred",
    id: "starred",
    icon: Star,
  },
  {
    title: "Snoozed",
    id: "snoozed",
    icon: Clock,
  },
  {
    title: "Sent",
    id: "sent",
    icon: Send,
  },
  {
    title: "Drafts",
    id: "drafts",
    icon: File,
  },
  {
    title: "Archive",
    id: "archive",
    icon: Archive,
  },
  {
    title: "Trash",
    id: "trash",
    icon: Trash2,
  },
  {
    title: "Settings",
    id: "settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const { 
    currentFolder, currentLabelId, setCurrentFolder, setComposeOpen, labels, fetchLabels, setCurrentLabel,
    savedSearches, fetchSavedSearches, renameSavedSearch, deleteSavedSearch, setSearchQuery, searchEmails
  } = useEmailStore();
  const { setSettingsOpen } = useSettingsStore();

  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedSavedSearchId, setSelectedSavedSearchId] = React.useState<string | null>(null);
  const [renameInput, setRenameInput] = React.useState("");
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    fetchLabels();
    fetchSavedSearches();
  }, [fetchLabels, fetchSavedSearches]);

  const handleSavedSearchClick = (query: string) => {
    setSearchQuery(query);
    searchEmails(query);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSavedSearchId || !renameInput.trim()) return;
    
    setIsRenaming(true);
    try {
      const success = await renameSavedSearch(selectedSavedSearchId, renameInput);
      if (success) {
        toast.success("Saved search renamed");
        setRenameDialogOpen(false);
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to rename saved search");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedSavedSearchId) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteSavedSearch(selectedSavedSearchId);
      if (success) {
        toast.success("Saved search deleted");
        setDeleteDialogOpen(false);
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to delete saved search");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <aside className="hidden w-64 flex-col border-r bg-muted/40 md:flex">
      <div className="flex h-14 items-center border-b px-6 lg:h-[60px]">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Inbox className="h-6 w-6 text-primary" />
          <span className="text-xl tracking-tight">InboxIQ</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <div className="px-4 mb-4">
          <Button 
            className="w-full justify-start gap-2 h-10" 
            onClick={() => setComposeOpen(true)}
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
                    onClick={() => setCurrentLabel(label._id)}
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
        
        {savedSearches.length > 0 && (
          <div className="mt-4 mb-4">
            <h4 className="mb-1 px-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Saved Searches
            </h4>
            <nav className="grid gap-1 px-4 text-sm font-medium">
              {savedSearches.map((search) => (
                <div key={search._id} className="relative group flex items-center">
                  <button
                    onClick={() => handleSavedSearchClick(search.query)}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "justify-start gap-3 flex-1 text-muted-foreground hover:bg-muted hover:text-foreground pr-8"
                    )}
                  >
                    <Bookmark className="h-4 w-4 text-primary" />
                    <span className="truncate">{search.name}</span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="absolute right-0 h-full px-2 opacity-0 group-hover:opacity-100 hover:bg-transparent">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedSavedSearchId(search._id);
                        setRenameInput(search.name);
                        setRenameDialogOpen(true);
                      }}>
                        <Edit2 className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground" onClick={() => {
                        setSelectedSavedSearchId(search._id);
                        setDeleteDialogOpen(true);
                      }}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Saved Search</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="renameSearch">Search Name</Label>
              <Input
                id="renameSearch"
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                autoFocus
                disabled={isRenaming}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameDialogOpen(false)} disabled={isRenaming}>
                Cancel
              </Button>
              <Button type="submit" disabled={isRenaming || !renameInput.trim()}>
                {isRenaming ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete saved search?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this saved search? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteSubmit} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
