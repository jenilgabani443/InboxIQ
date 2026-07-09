"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { authService } from "@/services/authService";
import { useAuthStore } from "@/store/authStore";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Assuming verifyMfaSchema is simple 6-digit code
const mfaSchema = z.object({
  totpCode: z
    .string()
    .length(6, "Code must be exactly 6 digits")
    .regex(/^\d+$/, "Code must contain only numbers"),
});

type MfaFormValues = z.infer<typeof mfaSchema>;

export function MfaForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const updateUser = useAuthStore((state) => state.updateUser);

  const form = useForm<MfaFormValues>({
    resolver: zodResolver(mfaSchema),
    defaultValues: {
      totpCode: "",
    },
  });

  async function onSubmit(data: MfaFormValues) {
    setIsLoading(true);
    try {
      await authService.verifyMfa({
        totpCode: data.totpCode,
      });

      updateUser({ mfaEnabled: true });
      toast.success("MFA verified successfully!");
      router.push("/");
    } catch (error: unknown) {
      const err = error as import("axios").AxiosError<{message: string}>;
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Invalid MFA code.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-lg border-muted">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Two-Factor Authentication</CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code from your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="totpCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authentication Code</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="123456" 
                        maxLength={6}
                        autoComplete="one-time-code"
                        {...field} 
                        disabled={isLoading} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
