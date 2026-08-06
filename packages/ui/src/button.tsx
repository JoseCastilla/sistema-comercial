import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({ children, variant = "primary", fullWidth = false, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: "primary" | "secondary" | "danger" | "quiet"; fullWidth?: boolean }) {
  const classes = ["ui-button", `ui-button--${variant}`, fullWidth ? "ui-button--full" : "", className].filter(Boolean).join(" ");
  return <button className={classes} {...props}>{children}</button>;
}
