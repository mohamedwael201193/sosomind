'use client';
import { useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export function CustomCursor() {
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Dot — fast spring
  const dotX = useSpring(mouseX, { stiffness: 450, damping: 30, mass: 0.4 });
  const dotY = useSpring(mouseY, { stiffness: 450, damping: 30, mass: 0.4 });

  // Ring — softer lag
  const ringX = useSpring(mouseX, { stiffness: 160, damping: 24, mass: 0.7 });
  const ringY = useSpring(mouseY, { stiffness: 160, damping: 24, mass: 0.7 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [mouseX, mouseY]);

  return (
    <>
      {/* Trailing ring */}
      <motion.div
        style={{ x: ringX, y: ringY }}
        className="fixed top-0 left-0 pointer-events-none z-[9997] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <div
          className="w-9 h-9 rounded-full border"
          style={{
            borderColor: 'var(--accent)',
            opacity: 0.25,
            mixBlendMode: 'screen',
          }}
        />
      </motion.div>

      {/* Main dot */}
      <motion.div
        style={{ x: dotX, y: dotY }}
        className="fixed top-0 left-0 pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2"
        aria-hidden="true"
      >
        <div
          className="w-4 h-4 rounded-full"
          style={{
            background: 'var(--accent)',
            mixBlendMode: 'difference',
            boxShadow: '0 0 10px var(--green-glow)',
          }}
        />
      </motion.div>
    </>
  );
}
