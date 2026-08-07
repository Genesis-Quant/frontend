import { useId } from "react";

import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { Switch } from "@/ui/switch";

type FieldStyleProps = { className?: string; controlClassName?: string; labelClassName?: string };

export function SelectField({ className = "space-y-2", controlClassName = "w-full", disabled = false, label, labelClassName, onChange, options, value }: FieldStyleProps & { disabled?: boolean; label: string; onChange: (value: string) => void; options: { label: string; value: string }[]; value: string }) {
  return <div className={className}><Label className={labelClassName}>{label}</Label><Select disabled={disabled} value={value} onValueChange={onChange}><SelectTrigger className={controlClassName}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

export function TextField({ className = "space-y-2", controlClassName, disabled = false, label, labelClassName, onChange, type = "text", value }: FieldStyleProps & { disabled?: boolean; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <div className={className}><Label className={labelClassName}>{label}</Label><Input className={controlClassName} disabled={disabled} type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

export function NumberField({ className = "space-y-2", controlClassName, disabled = false, label, labelClassName, max, min, onChange, step = 1, value }: FieldStyleProps & { disabled?: boolean; label: string; max?: number; min: number; onChange: (value: number) => void; step?: number; value: number }) {
  return <div className={className}><Label className={labelClassName}>{label}</Label><Input className={controlClassName} disabled={disabled} max={max} min={min} step={step} type="number" value={value} onChange={(event) => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(Math.max(min, max === undefined ? next : Math.min(max, next))); }} /></div>;
}

export function SwitchField({ checked, checkedText, className = "space-y-2", disabled = false, label, labelClassName, onChange, uncheckedText }: FieldStyleProps & { checked: boolean; checkedText: string; disabled?: boolean; label: string; onChange: (checked: boolean) => void; uncheckedText: string }) {
  const id = useId();
  return <div className={className}>
    <Label className={labelClassName} htmlFor={id}>{label}</Label>
    <label className="flex h-11 select-none items-center justify-between rounded-lg border border-input bg-transparent px-4 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-ring/70 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 dark:bg-input/30" htmlFor={id}>
      <span>{checked ? checkedText : uncheckedText}</span>
      <Switch checked={checked} disabled={disabled} id={id} size="lg" onCheckedChange={onChange} />
    </label>
  </div>;
}
