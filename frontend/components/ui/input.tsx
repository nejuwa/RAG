import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id ?? props.name;
    const helpId = `${inputId}-help`;
    return (
      <div className="grid gap-1.5">
        <label className="text-sm font-medium text-ink" htmlFor={inputId}>
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? helpId : undefined}
          className={`min-h-11 rounded-md border bg-white px-3 py-2 text-base text-ink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-canvas ${error ? "border-danger" : "border-line"} ${className}`}
          {...props}
        />
        {(error || hint) && (
          <p
            className={`text-sm ${error ? "text-danger" : "text-muted"}`}
            id={helpId}
          >
            {error ?? hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
