import { redirect } from 'next/navigation';

/** Root avoids compiling the heavy landing bundle on first dev request. */
export default function Home() {
  redirect('/track-record');
}
