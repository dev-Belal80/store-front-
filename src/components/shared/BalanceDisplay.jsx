import { formatCurrency, getBalanceColor, getBalanceLabel } from '../../utils/formatters';
import { cn } from '../../lib/utils';

export default function BalanceDisplay({ balance }) {
  const colorClass = getBalanceColor(balance);
  const label = getBalanceLabel(balance);

  return (
    <span className={cn('text-sm font-semibold', colorClass)}>
      {formatCurrency(balance)} — {label}
    </span>
  );
}