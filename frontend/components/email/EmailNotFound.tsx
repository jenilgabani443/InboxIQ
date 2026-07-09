import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmailNotFoundProps {
  message?: string;
  onBack?: () => void;
}

export function EmailNotFound({ message = "Email not found or unable to load.", onBack }: EmailNotFoundProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-background">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
        <AlertCircle className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight mb-2">Oops!</h2>
      <p className="text-muted-foreground mb-8 max-w-sm">
        {message}
      </p>
      {onBack && (
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Inbox
        </Button>
      )}
    </div>
  );
}
