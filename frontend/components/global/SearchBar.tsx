"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEmailStore } from "@/store/emailStore";

export function SearchBar() {
  const { searchQuery, setSearchQuery, searchEmails } = useEmailStore();
  const [localQuery, setLocalQuery] = React.useState(searchQuery);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== searchQuery) {
        setSearchQuery(localQuery);
        searchEmails(localQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, setSearchQuery, searchEmails]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalQuery(e.target.value);
  };
  return (
    <div className="relative w-full max-w-xl">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="h-4 w-4 text-muted-foreground" />
      </div>
      <Input
        type="search"
        placeholder="Search emails..."
        value={localQuery}
        onChange={handleChange}
        className="w-full pl-10 bg-background border-muted-foreground/20 focus-visible:ring-primary/50"
      />
    </div>
  );
}
