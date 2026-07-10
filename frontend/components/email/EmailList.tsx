"use client";

import * as React from "react";
import { useEffect } from "react";
import { useEmailStore } from "@/store/emailStore";
import { EmailListItem } from "./EmailListItem";
import { EmailListSkeleton } from "./EmailListSkeleton";
import { ErrorState } from "./ErrorState";
import { EmptyInbox } from "./EmptyInbox";

export function EmailList() {
  const { emails, loading, error, selectedEmailId, currentFolder, currentLabelId, isSearching, searchQuery, fetchInbox, fetchSent, fetchArchived, fetchTrash, fetchDrafts, fetchEmailsByLabel, searchEmails, setSelectedEmail } = useEmailStore();

  useEffect(() => {
    if (isSearching) return; // Do not fetch folder data if a search is active

    if (currentFolder === "inbox") {
      fetchInbox();
    } else if (currentFolder === "sent") {
      fetchSent();
    } else if (currentFolder === "archive") {
      fetchArchived();
    } else if (currentFolder === "trash") {
      fetchTrash();
    } else if (currentFolder === "drafts") {
      fetchDrafts();
    } else if (currentFolder === "label" && currentLabelId) {
      fetchEmailsByLabel(currentLabelId);
    }
  }, [currentFolder, currentLabelId, isSearching, fetchInbox, fetchSent, fetchArchived, fetchTrash, fetchDrafts, fetchEmailsByLabel]);

  if (loading && emails.length === 0) {
    return <EmailListSkeleton />;
  }

  if (error) {
    let retryFn = fetchInbox;
    if (isSearching) {
      retryFn = () => searchEmails(searchQuery);
    } else {
      if (currentFolder === "sent") retryFn = fetchSent;
      if (currentFolder === "archive") retryFn = fetchArchived;
      if (currentFolder === "trash") retryFn = fetchTrash;
      if (currentFolder === "drafts") retryFn = fetchDrafts;
      if (currentFolder === "label" && currentLabelId) retryFn = () => fetchEmailsByLabel(currentLabelId);
    }
    return <ErrorState message={error} onRetry={retryFn} />;
  }

  if (emails.length === 0) {
    if (isSearching) {
      return <EmptyInbox 
        icon="mail"
        title="No matching emails" 
        description="Try different keywords." 
      />;
    }
    if (currentFolder === "sent") {
      return <EmptyInbox 
        icon="send"
        title="No sent emails yet" 
        description="Emails you send will appear here." 
      />;
    }
    if (currentFolder === "archive") {
      return <EmptyInbox 
        icon="archive"
        title="Archived folder is empty" 
        description="Archived emails will appear here." 
      />;
    }
    if (currentFolder === "trash") {
      return <EmptyInbox 
        icon="trash"
        title="Trash is empty" 
        description="Deleted emails will appear here." 
      />;
    }
    if (currentFolder === "drafts") {
      return <EmptyInbox 
        icon="drafts"
        title="No drafts" 
        description="Saved drafts will appear here." 
      />;
    }
    if (currentFolder === "label") {
      return <EmptyInbox 
        icon="mail"
        title="No emails" 
        description="No emails found with this label." 
      />;
    }
    return <EmptyInbox />;
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {emails.map((email) => (
        <EmailListItem
          key={email.id || email._id}
          email={email}
          isSelected={selectedEmailId === (email.id || email._id)}
          onClick={() => setSelectedEmail(email.id || email._id || null)}
        />
      ))}
    </div>
  );
}
