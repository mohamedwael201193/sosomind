'use client';
import { useEffect, useRef } from 'react';

interface GridNode {
  x: number;
  y: number;
  pulseSpeed: number;
  pulseOffset: number;
}

interface Packet {
  gridX: number;
  gridY: number;
  pos: number;
  speed: number;
  direction: 'h' | 'v';
  length: number;
}

const GRID = 72;
const ACCENT = '160, 170, 210';
const CYAN   = '140, 160, 220';

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width  = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    let animId = 0;
    let t = 0;

    const buildNodes = (): GridNode[] => {
      const nodes: GridNode[] = [];
      const cols = Math.ceil(w / GRID) + 1;
      const rows = Math.ceil(h / GRID) + 1;
      for (let c = 0; c <= cols; c++) {
        for (let r = 0; r <= rows; r++) {
          if (Math.random() < 0.22) {
            nodes.push({
              x: c * GRID,
              y: r * GRID,
              pulseSpeed:  0.4 + Math.random() * 1.2,
              pulseOffset: Math.random() * Math.PI * 2,
            });
          }
        }
      }
      return nodes;
    };

    const buildPackets = (): Packet[] => {
      const pkts: Packet[] = [];
      const cols = Math.ceil(w / GRID);
      const rows = Math.ceil(h / GRID);
      for (let i = 0; i < 10; i++) {
        const isH = Math.random() > 0.5;
        pkts.push({
          gridX:     Math.floor(Math.random() * cols) * GRID,
          gridY:     Math.floor(Math.random() * rows) * GRID,
          pos:       Math.random() * (isH ? w : h),
          speed:     1.2 + Math.random() * 2.2,
          direction: isH ? 'h' : 'v',
          length:    28 + Math.random() * 40,
        });
      }
      return pkts;
    };

    let nodes   = buildNodes();
    let packets = buildPackets();

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      t += 0.008;

      /* grid lines */
      ctx.strokeStyle = `rgba(${ACCENT}, 0.022)`;
      ctx.lineWidth = 1;
      const cols = Math.ceil(w / GRID);
      const rows = Math.ceil(h / GRID);
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * GRID, 0); ctx.lineTo(c * GRID, h); ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * GRID); ctx.lineTo(w, r * GRID); ctx.stroke();
      }

      /* nodes */
      nodes.forEach((node) => {
        const alpha = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(t * node.pulseSpeed + node.pulseOffset));
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 10);
        grd.addColorStop(0, `rgba(${ACCENT}, ${alpha * 0.7})`);
        grd.addColorStop(1, `rgba(${ACCENT}, 0)`);
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(node.x, node.y, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(${ACCENT}, ${Math.min(alpha * 1.8, 0.95)})`;
        ctx.beginPath(); ctx.arc(node.x, node.y, 1.8, 0, Math.PI * 2); ctx.fill();
      });

      /* packets */
      packets.forEach((pkt) => {
        if (pkt.direction === 'h') {
          pkt.pos += pkt.speed;
          if (pkt.pos > w + pkt.length) pkt.pos = -pkt.length;
          const { pos: x, gridY: y, length } = pkt;
          const g = ctx.createLinearGradient(x - length, y, x, y);
          g.addColorStop(0, `rgba(${ACCENT}, 0)`); g.addColorStop(1, `rgba(${ACCENT}, 0.55)`);
          ctx.fillStyle = g; ctx.fillRect(x - length, y - 1, length, 2);
          ctx.fillStyle = `rgba(${ACCENT}, 1)`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
        } else {
          pkt.pos += pkt.speed;
          if (pkt.pos > h + pkt.length) pkt.pos = -pkt.length;
          const { gridX: x, pos: y, length } = pkt;
          const g = ctx.createLinearGradient(x, y - length, x, y);
          g.addColorStop(0, `rgba(${ACCENT}, 0)`); g.addColorStop(1, `rgba(${ACCENT}, 0.55)`);
          ctx.fillStyle = g; ctx.fillRect(x - 1, y - length, 2, length);
          ctx.fillStyle = `rgba(${ACCENT}, 1)`; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
        }
      });

      /* ambient glow orbs */
      const g1 = ctx.createRadialGradient(0, h, 0, 0, h, h * 0.65);
      g1.addColorStop(0, `rgba(${ACCENT}, 0.04)`); g1.addColorStop(1, `rgba(${ACCENT}, 0)`);
      ctx.fillStyle = g1; ctx.fillRect(0, 0, w, h);

      /* subtle orange accent glow top-right */
      const g2 = ctx.createRadialGradient(w * 0.85, h * 0.08, 0, w * 0.85, h * 0.08, h * 0.45);
      g2.addColorStop(0, `rgba(249, 115, 22, 0.04)`); g2.addColorStop(1, `rgba(249, 115, 22, 0)`);
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);

      const pa = 0.012 + 0.005 * Math.sin(t * 0.6);
      const g3 = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.5);
      g3.addColorStop(0, `rgba(${ACCENT}, ${pa})`); g3.addColorStop(1, `rgba(${ACCENT}, 0)`);
      ctx.fillStyle = g3; ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    };

    draw();

    const onResize = () => {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
      nodes   = buildNodes();
      packets = buildPackets();
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
