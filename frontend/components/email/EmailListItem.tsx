import * as React from "react";
import { Email } from "@/types/email";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { isToday, format } from "date-fns";

interface EmailListItemProps {
  email: Email;
  isSelected?: boolean;
  onClick?: () => void;
}

export function EmailListItem({ email, isSelected, onClick }: EmailListItemProps) {
  const getDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) {
      return format(date, "h:mm a");
    }
    // eslint-disable-next-line react-hooks/purity
    if (Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return format(date, "MMM d");
    }
    return format(date, "MM/dd/yy");
  };

  const senderName = email.from.name || email.from.email.split("@")[0];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-all hover:bg-accent hover:text-accent-foreground",
        !email.isRead && "bg-muted/40",
        isSelected && "bg-muted"
      )}
    >
      <div className="flex items-center gap-2 pt-1">
        <div className="text-muted-foreground group-hover:text-yellow-400 transition-colors">
          <Star
            className={cn(
              "h-4 w-4",
              email.isStarred && "fill-yellow-400 text-yellow-400"
            )}
          />
        </div>
        {!email.isRead && (
          <div className="h-2 w-2 rounded-full bg-primary" />
        )}
      </div>

      <div className="flex w-full flex-col gap-1 overflow-hidden">
        <div className="flex items-center justify-between">
          <span className={cn("truncate", !email.isRead && "font-bold")}>{senderName}</span>
          <span className="whitespace-nowrap text-xs text-muted-foreground ml-2">
            {getDisplayDate(email.createdAt)}
          </span>
        </div>

        <div className={cn("truncate text-sm", !email.isRead ? "font-bold" : "font-medium")}>
          {email.subject || "(No subject)"}
        </div>
        
        <div className="flex items-center gap-2 mt-1 w-full overflow-hidden">
          {email.labels && email.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 shrink-0">
              {email.labels.map(label => (
                <div 
                  key={label._id} 
                  className="px-1.5 py-0.5 text-[10px] rounded border"
                  style={{ borderColor: label.color, color: label.color }}
                >
                  {label.name}
                </div>
              ))}
            </div>
          )}
          <div className="truncate text-xs text-muted-foreground flex-1">
            {email.snippet || "..."}
          </div>
        </div>
      </div>
    </button>
  );
}
