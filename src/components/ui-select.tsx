"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { value: string; label: React.ReactNode; disabled?: boolean };

function optionsFromChildren(children: React.ReactNode): Option[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const element = child as React.ReactElement<{ value?: string; disabled?: boolean; children?: React.ReactNode }>;
    if (element.type === "option") return [{ value: String(element.props.value ?? ""), label: element.props.children, disabled: element.props.disabled }];
    return optionsFromChildren(element.props.children);
  });
}

/** A shadcn-style Radix Select with a small compatibility layer for the app's
 * existing native-select call sites. The hidden input preserves form submits. */
export function Select({ children, value, defaultValue, onChange, className, name, required, disabled, id }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const options = React.useMemo(() => optionsFromChildren(children), [children]);
  const [internalValue, setInternalValue] = React.useState(() => String(value ?? defaultValue ?? ""));
  const selectedValue = value == null ? internalValue : String(value);
  const selected = options.find((option) => option.value === selectedValue);

  function change(nextValue: string) {
    if (value == null) setInternalValue(nextValue);
    onChange?.({ target: { value: nextValue, name } } as React.ChangeEvent<HTMLSelectElement>);
  }

  return <SelectPrimitive.Root value={selectedValue} onValueChange={change} disabled={disabled}>
    {name && <input type="hidden" name={name} value={selectedValue} required={required} />}
    <SelectPrimitive.Trigger id={id} aria-required={required} className={cn("flex h-10 w-full items-center justify-between rounded-lg border bg-surface px-3 text-left text-sm font-medium text-ink shadow-sm outline-none transition-[border-color,box-shadow] hover:bg-surface2 focus:ring-2 focus:ring-accent/35 data-[placeholder]:text-muted disabled:cursor-not-allowed disabled:opacity-50", className)}>
      <SelectPrimitive.Value placeholder="Select an option">{selected?.label}</SelectPrimitive.Value>
      <SelectPrimitive.Icon><ChevronDown className="h-4 w-4 text-muted" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={6} className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-surface p-1 shadow-lg">
        <SelectPrimitive.Viewport>
          {options.map((option) => <SelectPrimitive.Item key={option.value} value={option.value} disabled={option.disabled} className="relative flex cursor-default select-none items-center rounded-md py-2 pl-8 pr-3 text-sm font-medium text-ink outline-none data-[highlighted]:bg-accent-soft data-[highlighted]:text-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50"><span className="absolute left-2 flex h-4 w-4 items-center justify-center"><SelectPrimitive.ItemIndicator><Check className="h-3.5 w-3.5" /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText></SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>;
}
