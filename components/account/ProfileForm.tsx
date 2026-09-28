"use client";

import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/client";
import { translateAuthError } from "@/lib/i18n/errors";
import { updateProfileSchema, UpdateProfileInput } from "@/lib/validations/auth";
import { updateProfile } from "@/app/actions/account";

interface ProfileFormProps {
  name: string;
}

// The email address moved to EmailForm, which owns verification and changes.
export function ProfileForm({ name }: ProfileFormProps) {
  const { t } = useTranslation();
  const { update } = useSession();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    const formData = new FormData();
    formData.append("name", data.name);

    const result = await updateProfile(formData);

    if (!result.success) {
      toast.error(translateAuthError(t, result.error));
      return;
    }

    // Forces the `jwt` callback to re-read the row so the navbar picks up the
    // new name without a sign-out.
    await update();
    toast.success(t.account.profile.success);
  };

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-bold">{t.account.profile.title}</CardTitle>
        <CardDescription>{t.account.profile.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-name">{t.account.profile.name}</Label>
            <Input
              id="account-name"
              type="text"
              placeholder={t.account.profile.namePlaceholder}
              autoComplete="name"
              className="bg-background/50"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">
                {translateAuthError(t, errors.name.message)}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <AiOutlineLoading3Quarters className="h-4 w-4 animate-spin" />
                {t.account.profile.submitting}
              </span>
            ) : (
              t.account.profile.submit
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
