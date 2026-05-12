import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset = (searchParams.get('asset') ?? 'BTC').toUpperCase();
  const direction = (searchParams.get('direction') ?? 'NEUTRAL').toUpperCase();
  const confidence = Number(searchParams.get('confidence') ?? 70);
  const outcome = (searchParams.get('outcome') ?? '').toUpperCase();

  const dirColor = direction === 'LONG' ? '#10b981' : direction === 'SHORT' ? '#ef4444' : '#fbbf24';
  const dirArrow = direction === 'LONG' ? '▲' : direction === 'SHORT' ? '▼' : '◆';
  const confColor = confidence >= 75 ? '#10b981' : confidence >= 55 ? '#fbbf24' : '#ef4444';

  const outcomeBg =
    outcome === 'HIT'  ? 'rgba(16,185,129,0.2)' :
    outcome === 'STOP' ? 'rgba(239,68,68,0.2)' :
    outcome === 'DRIFT' ? 'rgba(251,191,36,0.2)' : '';
  const outcomeColor =
    outcome === 'HIT'  ? '#10b981' :
    outcome === 'STOP' ? '#ef4444' :
    outcome === 'DRIFT'? '#fbbf24' : '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#030a05',
          padding: '52px 56px',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(0,255,127,0.12) 0%, transparent 70%)',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, left: -80,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(0,255,127,0.06) 0%, transparent 70%)',
        }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 44 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(0,255,127,0.12)', border: '1px solid rgba(0,255,127,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, color: '#00ff7f',
          }}>
            ◈
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            SoSoMind
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginLeft: 8 }}>AI Signal Intelligence</span>
        </div>

        {/* Asset + direction row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: 'rgba(0,255,127,0.08)', border: '1px solid rgba(0,255,127,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: '#00ff7f', letterSpacing: '-0.02em',
          }}>
            {asset.slice(0, 3)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {asset}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 14, fontWeight: 800, padding: '4px 12px', borderRadius: 6,
                background: `${dirColor}18`, border: `1px solid ${dirColor}50`, color: dirColor,
                letterSpacing: '0.05em',
              }}>
                {dirArrow} {direction}
              </span>
              {outcome && (
                <span style={{
                  fontSize: 14, fontWeight: 800, padding: '4px 12px', borderRadius: 6,
                  background: outcomeBg, border: `1px solid ${outcomeColor}50`, color: outcomeColor,
                  letterSpacing: '0.05em',
                }}>
                  {outcome}
                </span>
              )}
            </div>
          </div>
          {/* Confidence ring area */}
          <div style={{
            marginLeft: 'auto', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4,
          }}>
            <div style={{
              fontSize: 58, fontWeight: 900, color: confColor, letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums', lineHeight: 1,
            }}>
              {confidence}%
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Confidence
            </div>
          </div>
        </div>

        {/* Separator */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 28 }} />

        {/* Signal score breakdown labels */}
        <div style={{ display: 'flex', gap: 24, marginBottom: 28 }}>
          {[
            { label: 'Layer 1', sub: 'Fundraising', color: '#00ff7f' },
            { label: 'Layer 2', sub: 'Institutional', color: '#3b82f6' },
            { label: 'Layer 3', sub: 'ETF Flow', color: '#a78bfa' },
          ].map((item) => (
            <div key={item.label} style={{
              flex: 1, padding: '12px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ fontSize: 11, color: item.color, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {item.label}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                {item.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
            sosomind.vercel.app
          </div>
          <div style={{
            fontSize: 11, color: 'rgba(0,255,127,0.6)', letterSpacing: '0.08em',
            textTransform: 'uppercase', fontWeight: 700,
          }}>
            Powered by SoSoValue + SoDEX
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
