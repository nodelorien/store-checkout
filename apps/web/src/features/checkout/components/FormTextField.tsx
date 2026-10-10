import InputAdornment from '@mui/material/InputAdornment';
import type { SxProps, Theme } from '@mui/material/styles';
import TextField from '@mui/material/TextField';
import type { HTMLInputAutoCompleteAttribute, HTMLInputTypeAttribute, ReactNode } from 'react';
import { useController, type FieldPathByValue } from 'react-hook-form';
import type { PaymentInfoFormValues } from '../validation/schemas';

interface FormTextFieldProps {
  name: FieldPathByValue<PaymentInfoFormValues, string>;
  label: string;
  autoComplete: HTMLInputAutoCompleteAttribute;
  type?: HTMLInputTypeAttribute;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel';
  placeholder?: string;
  maxLength?: number;
  optional?: boolean;
  /** Normalises the value on every change (e.g. card number grouping). */
  format?: (value: string, previous: string) => string;
  /** Hint shown under the field when it has no error. */
  hint?: string;
  /** Message that marks the field invalid regardless of the form validation state. */
  warning?: string | null;
  endAdornment?: ReactNode;
  sx?: SxProps<Theme>;
}

/** A labelled text input bound to the checkout form, with inline error and a11y attributes. */
export function FormTextField({
  name,
  label,
  autoComplete,
  type = 'text',
  inputMode,
  placeholder,
  maxLength,
  optional = false,
  format,
  hint,
  warning = null,
  endAdornment,
  sx,
}: FormTextFieldProps) {
  const { field, fieldState } = useController<PaymentInfoFormValues, typeof name>({ name });
  const message = fieldState.error?.message ?? warning;

  return (
    <TextField
      id={`checkout-${name.replace('.', '-')}`}
      name={field.name}
      label={optional ? `${label} (optional)` : label}
      type={type}
      value={field.value}
      onChange={(event) =>
        field.onChange(format ? format(event.target.value, field.value) : event.target.value)
      }
      onBlur={field.onBlur}
      inputRef={field.ref}
      error={Boolean(message)}
      helperText={message ?? hint ?? ' '}
      placeholder={placeholder}
      sx={sx}
      slotProps={{
        htmlInput: {
          autoComplete,
          inputMode,
          maxLength,
          'aria-required': !optional,
          autoCapitalize: type === 'email' ? 'none' : undefined,
          spellCheck: false,
        },
        input: endAdornment
          ? { endAdornment: <InputAdornment position="end">{endAdornment}</InputAdornment> }
          : undefined,
      }}
    />
  );
}
