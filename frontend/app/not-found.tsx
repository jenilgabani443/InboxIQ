import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-4xl font-bold tracking-tight">404</h2>
      <p className="text-lg text-muted-foreground">Page not found</p>
      <p className="text-sm text-muted-foreground max-w-md">
        The page you are looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default", className: "mt-4" })}>
        Return Home
      </Link>
    </div>
  );
}
