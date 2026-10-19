"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { FieldMessage } from "./FieldMessage";

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className = "", error, ...props }, ref) => {
    const t = useTranslations();
    const [showPassword, setShowPassword] = useState(false);
    const errorId = useId();

    return (
      <div>
        {/* The eye button centres on the input alone — the error (below)
            stays out of this wrapper so a shown error doesn't shift it. */}
        <div className="relative">
          <Input
            ref={ref}
            type={showPassword ? "text" : "password"}
            className={`pr-13 ${className}`}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1 top-1/2 size-11 -translate-y-1/2 text-muted-foreground transition-[color,background-color,scale] hover:text-text"
            aria-label={showPassword ? t("password.hide") : t("password.show")}
          >
            {showPassword ? (
              <EyeOff strokeWidth={2.2} className="size-4.5" />
            ) : (
              <Eye strokeWidth={2.2} className="size-4.5" />
            )}
          </Button>
        </div>
        <FieldMessage show={!!error} id={errorId} role="alert" className="mt-2">
          {error}
        </FieldMessage>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
