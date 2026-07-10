import { Email } from "@/types/email";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, MoreVertical, X, Archive, ArchiveRestore, Trash2, Clock3, RotateCcw, PenSquare, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmailStore } from "@/store/emailStore";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";

interface EmailHeaderProps {
  email: Email;
  onBack: () => void;
}

export function EmailHeader({ email, onBack }: EmailHeaderProps) {
  const senderName = email.from.name || email.from.email.split("@")[0];
  const initials = senderName.slice(0, 2).toUpperCase();

  const { toggleStar, archiveEmail, unarchiveEmail, trashEmail, restoreFromTrash, currentFolder, setComposeOpen, setDraftEmailToEdit, labels, assignLabelToEmail, removeLabelFromEmail } = useEmailStore();

  const handleEditDraft = () => {
    setDraftEmailToEdit(email);
    setComposeOpen(true);
  };

  const handleToggleStar = () => toggleStar(email.id || email._id as string, !email.isStarred);
  const handleArchive = () => archiveEmail(email.id || email._id as string);
  const handleUnarchive = () => unarchiveEmail(email.id || email._id as string);
  const handleTrash = () => trashEmail(email.id || email._id as string);
  const handleRestore = () => restoreFromTrash(email.id || email._id as string);


  const toolbarActions = (
    <>
      {currentFolder === "archive" ? (
        <Button variant="ghost" size="icon" onClick={handleUnarchive} className="h-8 w-8 text-muted-foreground" title="Move to Inbox">
          <ArchiveRestore className="h-4 w-4" />
        </Button>
      ) : currentFolder === "trash" ? (
        <Button variant="ghost" size="icon" onClick={handleRestore} className="h-8 w-8 text-muted-foreground" title="Restore">
          <RotateCcw className="h-4 w-4" />
        </Button>
      ) : currentFolder === "drafts" ? (
        <Button variant="ghost" size="icon" onClick={handleEditDraft} className="h-8 w-8 text-muted-foreground" title="Edit Draft">
          <PenSquare className="h-4 w-4" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" onClick={handleArchive} className="h-8 w-8 text-muted-foreground" title="Archive">
          <Archive className="h-4 w-4" />
        </Button>
      )}
      <Button variant="ghost" size="icon" onClick={handleTrash} className="h-8 w-8 text-muted-foreground" title={currentFolder === "trash" ? "Delete forever" : "Delete"}>
        <Trash2 className="h-4 w-4" />
      </Button>

      <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-muted-foreground" title="Snooze">
        <Clock3 className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={handleToggleStar} className="h-8 w-8 text-muted-foreground" title={email.isStarred ? "Unstar" : "Star"}>
        <Star className={cn("h-4 w-4", email.isStarred && "fill-yellow-400 text-yellow-400")} />
      </Button>
      
      {labels.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-accent-foreground" title="Labels">
            <Tag className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {labels.map(label => {
              const hasLabel = email.labels?.some(l => l._id === label._id) ?? false;
              return (
                <DropdownMenuCheckboxItem
                  key={label._id}
                  checked={hasLabel}
                  onCheckedChange={(checked) => {
                    const emailId = email.id || email._id as string;
                    if (checked) {
                      assignLabelToEmail(emailId, label._id);
                    } else {
                      removeLabelFromEmail(emailId, label._id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                    {label.name}
                  </div>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button variant="ghost" size="icon" disabled className="h-8 w-8 text-muted-foreground" title="More options">
        <MoreVertical className="h-4 w-4" />
      </Button>
    </>
  );

  return (
    <div className="flex flex-col border-b">
      <div className="flex items-center gap-4 p-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden shrink-0" title="Back" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold line-clamp-2 flex-1">
          {email.subject || "(No subject)"}
        </h2>
        <div className="items-center gap-1 hidden md:flex">
          {toolbarActions}
        </div>
        <Button variant="ghost" size="icon" onClick={onBack} className="hidden md:flex shrink-0" title="Close" aria-label="Close">
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
            <div className="text-xs mt-0.5">
              <span className="text-muted-foreground">to </span>
              {email.to.map((t, i, arr) => (
                <span key={i}>
                  {t.name ? <span className="text-foreground">{t.name} </span> : null}
                  <span className="text-muted-foreground">&lt;{t.email}&gt;</span>
                  {i < arr.length - 1 && <span className="text-muted-foreground">, </span>}
                </span>
              ))}
            </div>
            {email.cc && email.cc.length > 0 && (
              <div className="text-xs mt-0.5">
                <span className="text-muted-foreground">cc: </span>
                {email.cc?.map((c, i, arr) => (
                  <span key={i}>
                    {c.name ? <span className="text-foreground">{c.name} </span> : null}
                    <span className="text-muted-foreground">&lt;{c.email}&gt;</span>
                    {i < arr.length - 1 && <span className="text-muted-foreground">, </span>}
                  </span>
                ))}
              </div>
            )}
            {email.bcc && email.bcc.length > 0 && (
              <div className="text-xs mt-0.5">
                <span className="text-muted-foreground">bcc: </span>
                {email.bcc?.map((b, i, arr) => (
                  <span key={i}>
                    {b.name ? <span className="text-foreground">{b.name} </span> : null}
                    <span className="text-muted-foreground">&lt;{b.email}&gt;</span>
                    {i < arr.length - 1 && <span className="text-muted-foreground">, </span>}
                  </span>
                ))}
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
