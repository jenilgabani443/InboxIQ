"use client";

import * as React from "react";
import { Search, History, BookmarkPlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEmailStore } from "@/store/emailStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function SearchBar() {
  const { 
    searchQuery, 
    setSearchQuery, 
    searchEmails, 
    searchHistory, 
    fetchSearchHistory, 
    clearSearchHistory,
    saveSearch
  } = useEmailStore();
  
  const [localQuery, setLocalQuery] = React.useState(searchQuery);
  const [isFocused, setIsFocused] = React.useState(false);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [saveName, setSaveName] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    if (isFocused && !localQuery) {
      fetchSearchHistory();
    }
  }, [isFocused, localQuery, fetchSearchHistory]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        setSearchQuery(localQuery);
        searchEmails(localQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, setSearchQuery, searchEmails]);

  // Handle clicking outside to close history dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  };

  const handleHistorySelect = (query: string) => {
    setLocalQuery(query);
    setSearchQuery(query);
    searchEmails(query);
    setIsFocused(false);
  };

  const handleClearHistory = async () => {
    try {
      await clearSearchHistory();
      toast.success("Search history cleared");
    } catch {
      // Error handled by store
    }
  };

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    
    setIsSaving(true);
    try {
      const success = await saveSearch(saveName, localQuery);
      if (success) {
        toast.success("Search saved");
        setShowSaveDialog(false);
        setSaveName("");
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to save search");
    } finally {
      setIsSaving(false);
    }
  };

  const showHistory = isFocused && !localQuery;

  return (
    <div className="relative w-full max-w-xl flex items-center gap-2">
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search emails..."
          value={localQuery}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          className="w-full pl-10 pr-10 bg-background border-muted-foreground/20 focus-visible:ring-primary/50"
        />
        {localQuery && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute inset-y-0 right-0 h-full px-3 py-2 text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => {
              setLocalQuery("");
              setSearchQuery("");
              searchEmails("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        {showHistory && (
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 py-2 max-h-[300px] overflow-auto"
          >
            <div className="px-3 py-1 flex items-center justify-between text-xs text-muted-foreground uppercase font-semibold">
              <span>Recent Searches</span>
              {searchHistory.length > 0 && (
                <button 
                  onClick={handleClearHistory}
                  className="hover:text-primary transition-colors hover:underline"
                >
                  Clear History
                </button>
              )}
            </div>
            {searchHistory.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground text-center">No recent searches</div>
            ) : (
              searchHistory.map((item, i) => (
                <button
                  key={i}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                  onClick={() => handleHistorySelect(item.query)}
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{item.query}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {localQuery && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setSaveName(localQuery);
            setShowSaveDialog(true);
          }}
          className="shrink-0"
        >
          <BookmarkPlus className="h-4 w-4 mr-2" />
          Save Search
        </Button>
      )}

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Search</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="searchName">Search Name</Label>
              <Input
                id="searchName"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Unread from boss"
                autoFocus
                disabled={isSaving}
              />
            </div>
            <div className="space-y-2">
              <Label>Query</Label>
              <div className="text-sm p-2 bg-muted rounded-md font-mono truncate">
                {localQuery}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowSaveDialog(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || !saveName.trim()}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
