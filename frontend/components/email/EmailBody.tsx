import { Email } from "@/types/email";

interface EmailBodyProps {
  email: Email;
}

export function EmailBody({ email }: EmailBodyProps) {
  if (email.bodyHtml) {
    return (
      <div 
        className="p-6 prose prose-sm max-w-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: email.bodyHtml }}
      />
    );
  }

  if (email.bodyText) {
    return (
      <div className="p-6 whitespace-pre-wrap font-sans text-sm">
        {email.bodyText}
      </div>
    );
  }

  return (
    <div className="p-6 text-muted-foreground text-sm italic">
      (No content)
    </div>
  );
}
