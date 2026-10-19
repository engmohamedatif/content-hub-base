import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export function RewardCelebration({ rewardKey, message }: { rewardKey: string; message: string }) {
  const [flying, setFlying] = useState(false);
  useEffect(() => {
    try {
      const key = `prestige-celebration:${rewardKey}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, 'seen');
    } catch { /* Celebration also works without browser storage. */ }
    setFlying(true);
    const timer = setTimeout(() => setFlying(false), 4000);
    return () => clearTimeout(timer);
  }, [rewardKey]);
  return <div role="status" className="relative overflow-hidden border-y border-brand-gold bg-secondary px-5 py-6 text-center">
    {flying && <div aria-hidden="true" className="reward-confetti">{Array.from({ length: 24 }, (_, i) => <i key={i} />)}</div>}
    <Sparkles className="relative mx-auto mb-2 size-8 text-brand-gold" />
    <p className="relative text-lg font-bold text-primary">مبروك يا جميلة!</p>
    <p className="relative mt-2 text-sm leading-7">{message}</p>
  </div>;
}