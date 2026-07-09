"use client";

import * as React from "react";
import { useEffect } from "react";
import { useEmailStore } from "@/store/emailStore";
import { EmailListItem } from "./EmailListItem";
import { EmailListSkeleton } from "./EmailListSkeleton";
import { ErrorState } from "./ErrorState";
import { EmptyInbox } from "./EmptyInbox";

export function EmailList() {
  const { emails, loading, error, selectedEmailId, fetchEmails, setSelectedEmail } = useEmailStore();

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  if (loading && emails.length === 0) {
    return <EmailListSkeleton />;
  }

  if (error && emails.length === 0) {
    return <ErrorState message={error} onRetry={fetchEmails} />;
  }

  if (emails.length === 0) {
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
