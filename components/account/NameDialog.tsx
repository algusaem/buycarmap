"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMessages, useTranslations } from "next-intl";
import { toast } from "sonner";
import { FieldMessage } from "@/components/auth/FieldMessage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/auth-client";
import { AUTH_ERROR } from "@/lib/auth/errors";
import { translateAuthError, translateRefusal } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { updateProfile } from "@/server/account/actions";
import { type UpdateProfileInput, updateProfileSchema } from "@/server/account/schema";
import {
  AccountDialog,
  type AccountDialogFrameProps,
  AccountDialogTitle,
  DialogActions,
  useAccountDialog,
} from "./AccountDialog";

// docs/specs/redesign-pages.md (PAGES-40, PAGES-71 to PAGES-73);
// F7-cuenta-editar › Cambiar nombre. «Nombre», holding the current name,
// «Guardar cambios», enabled from the start (RULES.md §19), and «Cancelar».
// Saving sends the name with the version the page rendered (DATA-15), once,
// busy while it runs; a name equal to the current one closes the dialog with
// no request and no toast. A conflict, a rate limit or an unexpected failure
// is a form alert above «Guardar cambios», never a toast (DATA-16 amended).

interface NameDialogProps extends AccountDialogFrameProps {
  name: string | null;
  version: number;
  /** Called with the name saved and the row's new version, so the card and the header show it. */
  onSaved: (name: string | null, version: number | undefined) => void;
}

export function NameDialog({ open, isPhone, returnFocusRef, onClose, ...form }: NameDialogProps) {
  return (
    <AccountDialog open={open} onClose={onClose} isPhone={isPhone} returnFocusRef={returnFocusRef}>
      <NameForm onClose={onClose} {...form} />
    </AccountDialog>
  );
}

type NameFormProps = Pick<NameDialogProps, "name" | "version" | "onClose" | "onSaved">;

function NameForm({ name, version, onClose, onSaved }: NameFormProps) {
  const t = useTranslations();
  const messages = useMessages() as Translations;
  const { run } = useAccountDialog();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    mode: "onBlur",
    defaultValues: { name: name ?? "" },
  });

  const onSubmit = async (data: UpdateProfileInput) => {
    setFormError(null);
    // The schema trims: an unchanged name is no change at all.
    if (data.name === (name ?? "")) {
      onClose();
      return;
    }

    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("version", String(version));
    const result = await run(() => updateProfile(formData));

    if (!result.success) {
      if (result.error === AUTH_ERROR.nameTooLong) {
        setError("name", { message: result.error }, { shouldFocus: true });
        return;
      }
      setFormError(translateRefusal(messages, result.error));
      return;
    }

    // Re-reads the session, so the header's avatar takes the new initial.
    authClient.$store?.notify("$sessionSignal");
    toast.success(t("account.profile.success"));
    onSaved(data.name || null, result.version);
  };

  return (
    <>
      <AccountDialogTitle>{t("account.profile.changeCta")}</AccountDialogTitle>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-name" className="text-field-label font-bold">
            {t("account.profile.name")}
          </Label>
          <Input
            id="account-name"
            type="text"
            placeholder={t("account.profile.namePlaceholder")}
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "account-name-error" : undefined}
            {...register("name")}
          />
          <FieldMessage show={!!errors.name} id="account-name-error" role="alert">
            {translateAuthError(messages, errors.name?.message)}
          </FieldMessage>
        </div>
        <FieldMessage show={!!formError} role="alert">
          {formError}
        </FieldMessage>
        <DialogActions busy={isSubmitting}>{t("account.profile.submit")}</DialogActions>
      </form>
    </>
  );
}
