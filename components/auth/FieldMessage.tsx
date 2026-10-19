import type { ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { crossFade } from "@/lib/animations";
import { usePresenceMotion } from "@/lib/hooks/usePresenceMotion";

interface FieldMessageProps {
  /** Whether the message is shown — `false`/`null` is "hidden", animated out. */
  show: boolean;
  id?: string;
  className?: string;
  "aria-live"?: "off" | "assertive" | "polite";
  role?: "alert";
  children: ReactNode;
}

/**
 * docs/design/canvas/R3-login.dc.html: the error line — the danger
 * circle-alert, then 14px weight 600 text. Shared by every auth field and
 * form-level message (LoginForm's email/totp/form errors and OAuth banner,
 * PasswordInput's error), so the icon, spacing and animation never drift
 * between them. Mounted unconditionally by its caller; `show` drives the
 * appear/disappear through `AnimatePresence`. A message already shown when
 * it mounts (the deletion warning, docs/specs/redesign-pages.md PAGES-54,
 * PAGES-58) belongs to the state that mounted it and draws at full opacity
 * at once, rather than fading on its own after a sheet that slides in. A
 * message a key caused (Enter submitting the form) appears and leaves at
 * once; one a pointer caused fades (MOTION-23, usePresenceMotion).
 */
export function FieldMessage({
  show,
  id,
  className,
  "aria-live": ariaLive,
  role,
  children,
}: FieldMessageProps) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <Message key="field-message" id={id} role={role} aria-live={ariaLive} className={className}>
          {children}
        </Message>
      )}
    </AnimatePresence>
  );
}

/** The drawn message, inside FieldMessage's AnimatePresence. */
function Message({
  id,
  className,
  "aria-live": ariaLive,
  role,
  children,
}: Omit<FieldMessageProps, "show">) {
  const fade = usePresenceMotion(crossFade);

  return (
    <motion.p
      id={id}
      role={role}
      aria-live={ariaLive}
      {...fade}
      className={cn("m-0 flex items-start gap-2.5 text-meta font-semibold text-text", className)}
    >
      <CircleAlert aria-hidden="true" className="mt-px size-4.5 shrink-0 text-danger" />
      {children}
    </motion.p>
  );
}
