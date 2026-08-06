import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className="ui-field"><span className="ui-field__label">{label}</span>{children}{hint ? <span className="ui-field__hint">{hint}</span> : null}{error ? <span className="ui-field__error">{error}</span> : null}</label>;
}

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={["ui-control", className].filter(Boolean).join(" ")} {...props} />;
}

export function SelectInput({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={["ui-control", "ui-control--select", className].filter(Boolean).join(" ")} {...props} />;
}
