"use client";

import * as React from "react";
import { useState } from "react";
import { useEmailStore } from "@/store/emailStore";
import { emailService } from "@/services/emailService";
import { X, Send, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export function ComposeDialog() {
  const { isComposeOpen, setComposeOpen, draftEmailToEdit, setDraftEmailToEdit, currentFolder, fetchDrafts } = useEmailStore();
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const resetForm = React.useCallback(() => {
    setTo("");
    setCc("");
    setBcc("");
    setSubject("");
    setBody("");
    setShowCcBcc(false);
    setError(null);
  }, []);

  React.useEffect(() => {
    if (isComposeOpen) {
      if (draftEmailToEdit) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTo(draftEmailToEdit.to?.map(t => t.email).join(", ") || "");
        setCc(draftEmailToEdit.cc?.map(c => c.email).join(", ") || "");
        setBcc(draftEmailToEdit.bcc?.map(b => b.email).join(", ") || "");
        setSubject(draftEmailToEdit.subject || "");
        setBody(draftEmailToEdit.bodyText || draftEmailToEdit.bodyHtml || "");
        setShowCcBcc(!!(draftEmailToEdit.cc?.length || draftEmailToEdit.bcc?.length));
      } else {
        resetForm();
      }
    }
  }, [isComposeOpen, draftEmailToEdit, resetForm]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isSending) {
      setComposeOpen(false);
      setDraftEmailToEdit(null);
    }
  };

  const parseEmails = (input: string) => {
    return input.split(",").map(e => e.trim()).filter(e => e).map(email => ({ email }));
  };

  const handleSend = async () => {
    setError(null);
    if (!to.trim()) {
      setError("Please specify at least one recipient.");
      return;
    }

    // basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const toEmails = parseEmails(to);
    
    for (const { email } of toEmails) {
      if (!emailRegex.test(email)) {
        setError(`Invalid email address: ${email}`);
        return;
      }
    }

    try {
      setIsSending(true);
      if (draftEmailToEdit) {
        const id = draftEmailToEdit.id || draftEmailToEdit._id;
        await emailService.updateDraft(id as string, {
          to: toEmails,
          cc: parseEmails(cc),
          bcc: parseEmails(bcc),
          subject,
          bodyText: body,
          bodyHtml: body,
        });
        toast.success("Draft updated successfully!");
        if (currentFolder === "drafts") fetchDrafts();
      } else {
        await emailService.sendEmail({
          to: toEmails,
          cc: parseEmails(cc),
          bcc: parseEmails(bcc),
          subject,
          bodyText: body,
          status: "sent",
        });
        toast.success("Email sent successfully!");
      }
      
      setComposeOpen(false);
      setDraftEmailToEdit(null);
      resetForm();
    } catch (err) {
      if (err instanceof Error) {
        setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || err.message);
      } else {
        setError("Failed to send email");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isComposeOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        showCloseButton={false}
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden",
          // Mobile: Full screen, no rounded corners, no borders
          "w-screen h-[100dvh] max-w-none max-h-none rounded-none border-0 m-0",
          // Desktop: Centered, rounded corners, borders
          "md:border md:rounded-xl",
          isMaximized 
            ? "md:w-[calc(100vw-48px)] md:h-[calc(100vh-48px)] md:max-w-none md:max-h-none"
            : "md:w-[600px] md:h-[600px] md:max-h-[calc(100vh-48px)]"
        )}
      >
        <DialogHeader className="p-4 sm:p-5 border-b flex flex-row items-center justify-between space-y-0 bg-muted/40 shrink-0">
          <DialogTitle className="text-sm font-semibold">{draftEmailToEdit ? "Edit Draft" : "New Message"}</DialogTitle>
          <DialogDescription className="sr-only">{draftEmailToEdit ? "Edit an existing draft" : "Compose a new email"}</DialogDescription>
          <div className="flex items-center gap-3 shrink-0 ml-auto z-10 hidden md:flex">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? "Minimize" : "Maximize"} aria-label={isMaximized ? "Minimize" : "Maximize"}>
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleOpenChange(false)} disabled={isSending} title="Close" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-auto z-10 md:hidden">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleOpenChange(false)} disabled={isSending} title="Close" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col p-4 sm:p-5 gap-4">
          <div className="flex items-center border focus-within:ring-1 ring-ring group rounded-md px-3 bg-background">
            <span className="text-sm text-muted-foreground w-12 shrink-0">To</span>
            <Input 
              autoFocus
              className="border-0 focus-visible:ring-0 shadow-none px-0 rounded-none h-10 flex-1" 
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder=""
              disabled={isSending}
            />
            {!showCcBcc && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 px-3 text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0 transition-colors" 
                onClick={() => setShowCcBcc(true)}
              >
                Cc/Bcc
              </Button>
            )}
          </div>

          {showCcBcc && (
            <>
              <div className="flex items-center border focus-within:ring-1 ring-ring rounded-md px-3 bg-background">
                <span className="text-sm text-muted-foreground w-12 shrink-0">Cc</span>
                <Input 
                  className="border-0 focus-visible:ring-0 shadow-none px-0 rounded-none h-10 flex-1" 
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  disabled={isSending}
                />
              </div>
              <div className="flex items-center border focus-within:ring-1 ring-ring rounded-md px-3 bg-background">
                <span className="text-sm text-muted-foreground w-12 shrink-0">Bcc</span>
                <Input 
                  className="border-0 focus-visible:ring-0 shadow-none px-0 rounded-none h-10 flex-1" 
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  disabled={isSending}
                />
              </div>
            </>
          )}

          <div className="flex items-center border focus-within:ring-1 ring-ring rounded-md px-3 bg-background">
            <Input 
              className="border-0 focus-visible:ring-0 shadow-none px-0 rounded-none h-10 flex-1 placeholder:text-muted-foreground/70" 
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSending}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-[200px] border focus-within:ring-1 ring-ring rounded-md bg-background overflow-hidden">
            <Textarea 
              className="border-0 focus-visible:ring-0 shadow-none p-3 resize-none flex-1 w-full h-full min-h-[200px]"
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isSending}
            />
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-5 border-t flex flex-row items-center justify-between gap-4 bg-muted/10 shrink-0">
          <div className="flex-1 overflow-hidden">
            {error && <span className="text-sm text-destructive font-medium truncate block">{error}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isSending}>
              Discard
            </Button>
            <Button onClick={handleSend} disabled={isSending} className="min-w-24 gap-2">
              {isSending ? (draftEmailToEdit ? "Saving..." : "Sending...") : (draftEmailToEdit ? "Save Draft" : "Send")}
              {!isSending && (draftEmailToEdit ? null : <Send className="h-4 w-4" />)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
