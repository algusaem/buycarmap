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

// Shown when /reset-password is opened without a token. A dead end with no way
// forward is the thing to avoid here: the primary action requests a fresh link.
export function InvalidResetLink() {
  const { t } = useTranslation();

  return (
    <motion.div {...fadeInUp}>
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold">
            {t.resetPassword.invalidTitle}
          </CardTitle>
          <CardDescription>
            {t.resetPassword.invalidDescription}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/20">
            <LinkIcon className="h-6 w-6 text-destructive" />
          </div>

          <Button asChild className="w-full" size="lg">
            <Link href="/forgot-password">
              {t.resetPassword.requestNewLink}
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full" size="lg">
            <Link href="/login">{t.resetPassword.backToLogin}</Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
