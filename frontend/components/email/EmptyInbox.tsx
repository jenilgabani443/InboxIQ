import * as React from "react";
import { Mail, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
        <Mail className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">No emails yet.</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        Your inbox is completely empty. When you receive a new email, it will show up here.
      </p>
      <Button className="gap-2">
        <Plus className="h-4 w-4" />
        Compose
      </Button>
    </div>
  );
}
