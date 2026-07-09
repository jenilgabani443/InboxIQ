import { LoginForm } from "@/features/auth/components/LoginForm";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
