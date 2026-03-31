import { Check, X } from "lucide-react";

interface Rule {
  label: string;
  test: (v: string) => boolean;
}

export default function Checklist({ rules, value }: { rules: Rule[]; value: string }) {
  return (
    <ul className="flex flex-col gap-1 -mt-2">
      {rules.map(rule => {
        const passed = rule.test(value);
        return (
          <li key={rule.label} className={`flex items-center gap-1.5 text-xs transition-colors duration-150 ${passed ? "text-service-color" : "text-secondary-text-color"}`}>
            {passed ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
