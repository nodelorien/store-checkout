import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { formatMoney } from '@/shared/lib/formatMoney';
import { installmentsChanged } from '../checkoutSlice';
import { selectInstallmentPlans, selectInstallments, type InstallmentPlan } from '../selectors';

export function installmentLabel(plan: InstallmentPlan, currency: string): string {
  const amount = formatMoney(plan.perInstallmentInCents, currency);
  return plan.installments === 1
    ? `1 payment of ${amount}`
    : `${plan.installments} payments of ${amount}`;
}

interface InstallmentsFieldProps {
  currency: string;
  disabled?: boolean;
}

/** How many instalments the card is charged in. The amounts are before any bank interest. */
export function InstallmentsField({ currency, disabled = false }: InstallmentsFieldProps) {
  const dispatch = useAppDispatch();
  const installments = useAppSelector(selectInstallments);
  const plans = useAppSelector(selectInstallmentPlans);

  if (plans.length === 0) return null;

  return (
    <TextField
      select
      size="small"
      label="Installments"
      value={installments}
      disabled={disabled}
      helperText="Your bank may add interest to payments in installments."
      onChange={(event) => dispatch(installmentsChanged(Number(event.target.value)))}
    >
      {plans.map((plan) => (
        <MenuItem key={plan.installments} value={plan.installments}>
          {installmentLabel(plan, currency)}
        </MenuItem>
      ))}
    </TextField>
  );
}
