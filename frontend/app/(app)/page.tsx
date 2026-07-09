"use client";

import { EmailList } from "@/components/email/EmailList";
import { EmailDetail } from "@/components/email/EmailDetail";
import { useEmailStore } from "@/store/emailStore";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const { selectedEmailId } = useEmailStore();

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Pane: Email List */}
      <div 
        className={cn(
          "h-full flex-col",
          selectedEmailId ? "hidden md:flex md:w-[350px] lg:w-[450px] border-r" : "flex w-full"
        )}
      >
        <div className="flex items-center justify-between pb-4 border-b p-4">
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        </div>
        <div className="flex-1 overflow-auto">
          <EmailList />
        </div>
      </div>

      {/* Right Pane: Email Detail */}
      {selectedEmailId && (
        <div className="flex h-full flex-col flex-1 w-full">
          <EmailDetail />
        </div>
      )}
    </div>
  );
}
