import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const baseInput = 'w-full rounded-sm border border-admin-border bg-white px-3 py-3 font-sans text-adminBody text-admin-text outline-none transition focus:border-admin-text';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  (props, ref) => (
    <input {...props} ref={ref} className={cn(baseInput, props.className)} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => (
    <textarea {...props} ref={ref} className={cn(baseInput, props.className)} />
  )
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  (props, ref) => (
    <select {...props} ref={ref} className={cn(baseInput, props.className)} />
  )
);
Select.displayName = 'Select';
