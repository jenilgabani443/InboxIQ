"use client";

import * as React from "react";
import { useEffect } from "react";
import { useEmailStore } from "@/store/emailStore";
import { EmailHeader } from "./EmailHeader";
import { EmailBody } from "./EmailBody";
import { EmailAttachments } from "./EmailAttachments";
import { EmailDetailSkeleton } from "./EmailDetailSkeleton";
import { EmailNotFound } from "./EmailNotFound";
import { ScrollArea } from "@/components/ui/scroll-area";

export function EmailDetail() {
  const { 
    selectedEmailId, 
    selectedEmail, 
    loadingEmail, 
    emailError, 
    fetchEmailById, 
    clearSelectedEmail,
  } = useEmailStore();

  useEffect(() => {
    if (selectedEmailId) {
      fetchEmailById(selectedEmailId);
    }
  }, [selectedEmailId, fetchEmailById]);


  if (!selectedEmailId) {
    return (
      <div className="flex h-full bg-muted/20" />
    );
  }

  if (loadingEmail && (!selectedEmail || (selectedEmail.id !== selectedEmailId && selectedEmail._id !== selectedEmailId))) {
    return <EmailDetailSkeleton />;
  }

  if (emailError || !selectedEmail) {
    return <EmailNotFound message={emailError || "Email not found."} onBack={clearSelectedEmail} />;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <EmailHeader email={selectedEmail} onBack={clearSelectedEmail} />
      <ScrollArea className="flex-1">
        <EmailBody email={selectedEmail} />
        <EmailAttachments attachments={selectedEmail.attachments} />
      </ScrollArea>
    </div>
  );
}
