"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthProps {
  password: string;
}

type Strength = "weak" | "fair" | "strong" | "very-strong";

interface CheckResult {
  label: string;
  passed: boolean;
}

function evaluatePassword(password: string): { strength: Strength; checks: CheckResult[] } {
  const checks: CheckResult[] = [
    { label: "At least 8 characters", passed: password.length >= 8 },
    { label: "Contains uppercase letter", passed: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", passed: /[a-z]/.test(password) },
    { label: "Contains number", passed: /\d/.test(password) },
    { label: "Contains special character", passed: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  let strength: Strength = "weak";
  if (passedCount >= 5) strength = "very-strong";
  else if (passedCount >= 4) strength = "strong";
  else if (passedCount >= 3) strength = "fair";

  return { strength, checks };
}

const STRENGTH_CONFIG: Record<Strength, { label: string; color: string; bars: number }> = {
  weak: { label: "Weak", color: "bg-red-500", bars: 1 },
  fair: { label: "Fair", color: "bg-yellow-500", bars: 2 },
  strong: { label: "Strong", color: "bg-green-500", bars: 3 },
  "very-strong": { label: "Very strong", color: "bg-green-600", bars: 4 },
};

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const { strength, checks } = useMemo(() => evaluatePassword(password), [password]);
  const config = STRENGTH_CONFIG[strength];

  if (!password) return null;

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= config.bars ? config.color : "bg-muted"
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${
        strength === "weak" ? "text-red-600" :
        strength === "fair" ? "text-yellow-600" :
        "text-green-600"
      }`}>
        Password strength: {config.label}
      </p>

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-1.5 text-xs">
            {check.passed ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            <span className={check.passed ? "text-foreground" : "text-muted-foreground"}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
