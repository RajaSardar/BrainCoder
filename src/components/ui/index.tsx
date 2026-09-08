"use client";

import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function CopyButton({ text, label = "Copy", className = "", disabled = false }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text, disabled]);

  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className = "", ...rest }: ButtonProps) {
  const base =
    "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-500/20"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">{label}</p>
      {children}
    </div>
  );
}

export function StyledTextarea({
  className = "",
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y ${className}`}
      {...rest}
    />
  );
}