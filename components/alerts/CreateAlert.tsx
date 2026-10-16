"use client";

import { type ReactNode, type RefObject, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { AlertCircle, Loader2 } from "lucide-react";
import { useLocale, useMessages, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneBottomSheet } from "@/components/map/phone/SheetChrome";
import { crossFade } from "@/lib/animations";
import { authClient } from "@/lib/auth/auth-client";
import { translateError } from "@/lib/i18n/errors";
import type { Translations } from "@/lib/i18n/types";
import { alertName, alertSummary } from "@/lib/search/alert-summary";
import type { SearchInput } from "@/lib/search/schema";
import { createAlert } from "@/server/alerts/actions";
import {
  ALERT_ERROR,
  ALERT_PLACE_NAME_MAX,
  alertCriteriaSchema,
  createAlertFormSchema,
  type CreateAlertFormValues,
  withoutUnsavedCriteria,
} from "@/server/alerts/schema";

// docs/specs/redesign-map.md (MAPUI-39 to MAPUI-46);
// docs/design/system/components/CreateAlert/README.md. Saves the map's search
// as an alert: the name, prefilled from the car and the place, the search
// summary, «Crear alerta» and «Cancelar». On desktop it is the 380px card the
// search pill anchors under the header's «Crear alerta» (`inline`; the pill
// owns the popover); on a phone, a bottom sheet over the dimmed map. A search
// with no brand, no maximum price and no place is too broad: the notice shows
// and «Crear alerta» is `aria-disabled`. It shows only to a signed-in buyer:
// the map page sends a signed-out one to sign in instead of opening it
// (lib/hooks/useMapPageState.ts, MAPUI-46).
export interface CreateAlertProps {
  open: boolean;
  criteria: SearchInput;
  placeName?: string;
  onClose: () => void;
  /** Desktop: only the card, for the search pill's popover to frame (MAPUI-39). */
  inline?: boolean;
  /** Phone: the results sheet's «Crear alerta», focused again when the sheet closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function CreateAlert({
  open,
  criteria,
  placeName,
  onClose,
  inline = false,
  returnFocusRef,
}: CreateAlertProps) {
  const { data: session } = authClient.useSession();
  const sheetRef = useRef<HTMLDivElement>(null);
  // Nothing is drawn until a session is known, so neither a signed-out buyer
  // nor a pending session ever sees an empty card.
  const shown = open && Boolean(session);
  const form = (
    <CreateAlertBody criteria={criteria} placeName={placeName} onClose={onClose} sheet={!inline} />
  );

  if (inline) {
    if (!shown) return null;
    return (
      <div className="w-95 rounded-card border border-line bg-surface p-5 font-sans text-text shadow-float">
        {form}
      </div>
    );
  }

  return (
    <PhoneBottomSheet
      open={shown}
      onClose={onClose}
      returnFocusRef={returnFocusRef}
      overlayClassName="bg-bg/72"
      className="gap-3.5 px-5 pb-sheet-bottom"
      entrance="slide"
      contentRef={sheetRef}
      // The title takes the focus, not the name field, so opening the
      // sheet does not pop the phone's keyboard up over it.
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        sheetRef.current?.querySelector<HTMLElement>("h2")?.focus();
      }}
    >
      {form}
    </PhoneBottomSheet>
  );
}

interface CreateAlertBodyProps {
  criteria: SearchInput;
  placeName?: string;
  onClose: () => void;
  sheet: boolean;
}

/** The dialog's contents, mounted on each opening so the name starts from the search. */
function CreateAlertBody({ criteria, placeName, onClose, sheet }: CreateAlertBodyProps) {
  const t = useTranslations();
  const locale = useLocale();
  const messages = useMessages() as Translations;
  const router = useRouter();
  const copy = { t, locale };
  const fieldId = useId();
  const [refusal, setRefusal] = useState<string | null>(null);

  const alertCriteria = withoutUnsavedCriteria(criteria);
  // server/alerts/actions.ts's own check: "too broad" is specifically the
  // specificity refinement failing, not any other reason the schema refuses
  // the criteria (an out-of-range field has its own, unrelated notice).
  const parsedCriteria = alertCriteriaSchema.safeParse(alertCriteria);
  const tooBroad =
    !parsedCriteria.success &&
    parsedCriteria.error.issues.every((issue) => issue.message === ALERT_ERROR.criteriaTooBroad);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAlertFormValues>({
    resolver: zodResolver(createAlertFormSchema),
    mode: "onBlur",
    defaultValues: { label: alertName(alertCriteria, placeName, copy) },
  });

  async function send(label: string) {
    try {
      // ALERTUI-48: the place chosen in «Dónde» goes as the alert's place name,
      // clipped to what the server stores (ALERTUI-47), so a long name never
      // makes the save fail.
      return await createAlert(alertCriteria, label, placeName?.slice(0, ALERT_PLACE_NAME_MAX));
    } catch {
      // A thrown action (the network, the server) has no code to explain it:
      // MAPUI-45's network copy, inline, with the dialog left open to try again.
      setRefusal(t("createAlert.networkError"));
      return null;
    }
  }

  async function submit({ label }: CreateAlertFormValues) {
    setRefusal(null);
    const result = await send(label);
    if (!result) return;
    if (!result.ok) {
      setRefusal(translateError(messages, result.error.messageKey));
      return;
    }

    onClose();
    // A variable, not an inline literal: `href` records where the action
    // leads, which Sonner's own action type does not name.
    const viewAlerts = {
      label: t("createAlert.viewAlerts"),
      href: "/alerts",
      onClick: () => router.push("/alerts"),
    };
    toast.success(t(result.value.created ? "createAlert.created" : "createAlert.alreadyExisted"), {
      action: viewAlerts,
    });
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        // Too broad: the button is `aria-disabled`, so pressing it sends nothing (MAPUI-41).
        if (tooBroad) {
          event.preventDefault();
          return;
        }
        void handleSubmit(submit)(event);
      }}
      className="flex flex-col gap-3.5"
    >
      <DialogOrPopoverTitle sheet={sheet}>{t("createAlert.title")}</DialogOrPopoverTitle>
      <div className="flex flex-col gap-2">
        <Label
          htmlFor={fieldId}
          className="text-field-label leading-normal font-bold text-text-muted"
        >
          {t("createAlert.name")}
        </Label>
        <Input
          id={fieldId}
          type="text"
          autoComplete="off"
          aria-invalid={errors.label ? true : undefined}
          aria-describedby={errors.label ? `${fieldId}-error` : undefined}
          {...register("label")}
        />
        <AnimatePresence initial={false}>
          {errors.label && (
            <Notice key="name-required" id={`${fieldId}-error`}>
              {t("createAlert.nameRequired")}
            </Notice>
          )}
        </AnimatePresence>
      </div>
      <p className="m-0 text-sm text-text-muted">{alertSummary(alertCriteria, placeName, copy)}</p>
      <AnimatePresence initial={false}>
        {tooBroad && <Notice key="too-broad">{t("createAlert.tooBroad")}</Notice>}
        {refusal && <Notice key="refusal">{refusal}</Notice>}
      </AnimatePresence>
      <div className="flex flex-col gap-1">
        <Button
          type="submit"
          variant="primary"
          size="48"
          aria-disabled={tooBroad || undefined}
          disabled={isSubmitting}
          className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
        >
          {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          {t("createAlert.submit")}
        </Button>
        <Button type="button" variant="ghost" size="44" onClick={onClose} className="w-full">
          {t("createAlert.cancel")}
        </Button>
      </div>
    </form>
  );
}

interface DialogOrPopoverTitleProps {
  sheet: boolean;
  children: ReactNode;
}

/**
 * «CREAR ALERTA»: the dialog's own title in the phone sheet, which Radix
 * names the dialog with, and the card's heading on desktop.
 */
function DialogOrPopoverTitle({ sheet, children }: DialogOrPopoverTitleProps) {
  const className = "m-0 font-display text-sheet-title font-extrabold uppercase lg:text-base";
  if (sheet) {
    return (
      <DialogPrimitive.Title tabIndex={-1} className={`${className} text-center`}>
        {children}
      </DialogPrimitive.Title>
    );
  }
  return <h2 className={className}>{children}</h2>;
}

interface NoticeProps {
  id?: string;
  children: ReactNode;
}

/** The too-broad notice, the empty-name error and a refused create, in one style (`role="alert"`), fading in and out. */
function Notice({ id, children }: NoticeProps) {
  return (
    <motion.p
      {...crossFade}
      id={id}
      role="alert"
      className="m-0 flex items-start gap-2 text-sm font-semibold text-text"
    >
      <AlertCircle aria-hidden="true" strokeWidth={2.2} className="size-4.5 shrink-0 text-danger" />
      {children}
    </motion.p>
  );
}
