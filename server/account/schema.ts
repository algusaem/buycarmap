import { z } from "zod";
import { AUTH_ERROR } from "@/lib/auth/errors";
import {
  confirmPassword,
  currentPasswordField,
  newPassword,
  passwordsMatch,
} from "@/server/auth/schema";

// DATA-15 (docs/specs/core-data-model.md): the version the form rendered, for
// optimistic locking. It is never a react-hook-form field — NameDialog and
// PasswordDialog append it to the submitted FormData directly instead of
// registering it as a controlled input — so it is kept off the schema the
// client-side resolver uses (mixing a `z.coerce` field into a react-hook-form
// generic does not type-check: the resolver's pre-parse input for it is
// `unknown`, which the form's own value type is not) and added only on the
// server-side variant each schema extends into. Required: a caller with no
// version to assert — a script, an older client — has nothing DATA-15's lock
// can check, so it is refused a parse rather than allowed to bypass it.
const version = z.coerce.number().int().positive();

const changePasswordFields = z.object({
  currentPassword: z.string().min(1, AUTH_ERROR.passwordRequired),
  password: newPassword,
  confirmPassword,
});

export const changePasswordSchema = changePasswordFields.refine(
  passwordsMatch.check,
  passwordsMatch.options,
);

export const changePasswordServerSchema = changePasswordFields
  .extend({ version })
  .refine(passwordsMatch.check, passwordsMatch.options);

export const updateProfileSchema = z.object({
  name: z.string().trim().max(80, AUTH_ERROR.nameTooLong),
});

export const updateProfileServerSchema = updateProfileSchema.extend({ version });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// PLAT-27 (docs/specs/core-platform.md): unlinkAccount's and deleteAccount's
// own input shapes.
export const unlinkAccountSchema = z.object({ provider: z.string().min(1) });
export const deleteAccountSchema = z.object({ password: currentPasswordField });

// docs/specs/redesign-pages.md (PAGES-54): the deletion confirmation's form.
// The typed word gates the button, not the parse; an account with no
// password confirms with the word alone.
export const deleteAccountFormSchema = deleteAccountSchema.extend({ confirmation: z.string() });
export const deletePasswordlessAccountFormSchema = deleteAccountFormSchema.extend({
  password: z.string(),
});

export type DeleteAccountFormInput = z.infer<typeof deleteAccountFormSchema>;

// EXPORT-14 (docs/specs/account-data-export.md): the one field of an export
// the browser reads back, to name the downloaded file after its UTC date.
export const dataExportEnvelopeSchema = z.object({ exportedAt: z.iso.datetime() });
