"use client";

import Link from "next/link";
import * as motion from "motion/react-client";
import { LinkIcon } from "lucide-react";
import { fadeInUp } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";

// Shown when /verify-email is opened without a token. Offers the way forward
// rather than leaving the user at a dead end.
export function InvalidVerifyLink() {
  const { t } = useTranslation();

  return (
    <motion.div {...fadeInUp}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold">
            {t.verifyEmail.invalidTitle}
          </CardTitle>
          <CardDescription>
            {t.verifyEmail.invalidDescription}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
            <LinkIcon className="h-6 w-6 text-destructive" />
          </div>

          <Button asChild className="w-full" size="lg">
            <Link href="/register">{t.verifyEmail.backToRegister}</Link>
          </Button>

          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/login">{t.auth.signIn}</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
