import { Email } from "@/types/email";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, MoreVertical, X, Archive, Trash2, Clock3, MailOpen, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailStore } from "@/store/emailStore";
import { format } from "date-fns";

interface EmailHeaderProps {
  email: Email;
  onBack: () => void;
}

export function EmailHeader({ email, onBack }: EmailHeaderProps) {
  const senderName = email.from.name || email.from.email.split("@")[0];
  const initials = senderName.slice(0, 2).toUpperCase();

  const { toggleStar, archiveEmail, trashEmail, markEmailAsRead } = useEmailStore();

  const handleToggleStar = () => toggleStar(email.id || email._id as string, !email.isStarred);
  const handleArchive = () => archiveEmail(email.id || email._id as string);
  const handleTrash = () => trashEmail(email.id || email._id as string);
  const handleToggleRead = () => markEmailAsRead(email.id || email._id as string, !email.isRead);

  const toolbarActions = (
    <>
      <Button variant="ghost" size="icon" onClick={handleArchive} className="h-8 w-8 text-muted-foreground" title="Archive">
        <Archive className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleTrash} className="h-8 w-8 text-muted-foreground" title="Delete">
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleToggleRead} className="h-8 w-8 text-muted-foreground" title={email.isRead ? "Mark as unread" : "Mark as read"}>
        {email.isRead ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-muted-foreground" title="Snooze">
        <Clock3 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleToggleStar} className="h-8 w-8 text-muted-foreground" title={email.isStarred ? "Unstar" : "Star"}>
        <Star className={cn("h-4 w-4", email.isStarred && "fill-yellow-400 text-yellow-400")} />
      </Button>
      <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-muted-foreground">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div className="flex flex-col border-b">
      <div className="flex items-center gap-4 p-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold line-clamp-2 flex-1">
          {email.subject || "(No subject)"}
        </h2>
        <div className="items-center gap-1 hidden md:flex">
          {toolbarActions}
        </div>
        <Button variant="ghost" size="icon" onClick={onBack} className="hidden md:flex shrink-0">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-start justify-between p-4 pt-0">
        <div className="flex items-start gap-4">
          <Avatar className="h-10 w-10 mt-1">
            <AvatarFallback className="bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{senderName}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline-block">
                &lt;{email.from.email}&gt;
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              to {email.to.map((t) => t.name || t.email).join(", ")}
            </div>
            {email.cc && email.cc.length > 0 && (
              <div className="text-xs text-muted-foreground mt-0.5">
                cc: {email.cc.map((c) => c.name || c.email).join(", ")}
              </div>
            )}
            {email.bcc && email.bcc.length > 0 && (
              <div className="text-xs text-muted-foreground mt-0.5">
                bcc: {email.bcc.map((b) => b.name || b.email).join(", ")}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {format(new Date(email.createdAt), "MMM d, yyyy, h:mm a")}
          </span>
          <div className="flex items-center gap-1 md:hidden">
            {toolbarActions}
          </div>
        </div>
      </div>
    </div>
  );
}
