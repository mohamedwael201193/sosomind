import { redirect } from 'next/navigation';

/** Canonical trade surface is /trade — wizard merged into main terminal. */
export default function TradeWizardRedirect() {
  redirect('/trade');
}
