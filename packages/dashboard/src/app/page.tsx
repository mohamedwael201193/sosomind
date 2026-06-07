import { redirect } from 'next/navigation';

/** OS home — proof + setup + primary CTA. */
export default function Home() {
  redirect('/dashboard');
}
