import type { ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import * as motion from "motion/react-client";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { crossFade } from "@/lib/animations";

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
 * appear/disappear through `AnimatePresence`.
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
    <AnimatePresence>
      {show && (
        <motion.p
          key="field-message"
          id={id}
          role={role}
          aria-live={ariaLive}
          {...crossFade}
          className={cn(
            "m-0 flex items-start gap-2.5 text-meta font-semibold text-text",
            className,
          )}
        >
          <CircleAlert aria-hidden="true" className="mt-px size-4.5 shrink-0 text-danger" />
          {children}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
