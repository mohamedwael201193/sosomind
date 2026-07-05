import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SignalDetailClient from '@/app/signals/[id]/SignalDetailClient';

export default function SignalDetailPage() {
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    document.title = 'Signal — SoSoMind';
  }, []);

  if (!id) {
    return null;
  }

  return <SignalDetailClient id={id} />;
}
