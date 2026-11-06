"use client";
import { useState, type InputHTMLAttributes } from "react";
import { TextField } from "./components";
import { Icon } from "./icons";

/** A password field with a show/hide eye. The eye is a real button (44px, labelled, announces its state) and never submits the form. */
export function PasswordField({ label, error, ...rest }: { label: string; error?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <TextField
      label={label}
      error={error}
      {...rest}
      type={shown ? "text" : "password"}
      trailing={
        <button type="button" className="rx-eye" aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} onClick={() => setShown((v) => !v)}>
          <Icon name={shown ? "eye-off" : "eye"} size={22} />
        </button>
      }
    />
  );
}
