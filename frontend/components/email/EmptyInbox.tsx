import * as React from "react";
import { Mail, Send, Archive, Trash2, FileEdit } from "lucide-react";

interface EmptyInboxProps {
  title?: string;
  description?: string;
  icon?: "mail" | "send" | "archive" | "trash" | "drafts";
}

export function EmptyInbox({ 
  title = "No emails yet.", 
  description = "Your inbox is completely empty. When you receive a new email, it will show up here.", 
  icon = "mail" 
}: EmptyInboxProps) {
  const Icon = icon === "send" ? Send : icon === "archive" ? Archive : icon === "trash" ? Trash2 : icon === "drafts" ? FileEdit : Mail;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center px-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-6">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">{title}</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        {description}
      </p>
    </div>
  );
}
