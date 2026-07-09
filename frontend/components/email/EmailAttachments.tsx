import { EmailAttachment } from "@/types/email";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmailAttachmentsProps {
  attachments?: EmailAttachment[];
}

export function EmailAttachments({ attachments }: EmailAttachmentsProps) {
  if (!attachments || attachments.length === 0) return null;

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  return (
    <div className="p-4 border-t">
      <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted-foreground">
        <Paperclip className="h-4 w-4" />
        {attachments.length} Attachment{attachments.length !== 1 ? "s" : ""}
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <Button
            key={attachment._id}
            variant="outline"
            className="flex flex-col items-start justify-center h-auto py-2 px-3 gap-1"
          >
            <span className="text-sm font-medium line-clamp-1 max-w-[200px]">
              {attachment.filename}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatBytes(attachment.sizeBytes)}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
