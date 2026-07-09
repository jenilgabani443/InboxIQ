import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>}>
      <RegisterForm />
    </Suspense>
  );
}
