/**
 * MEV Protection Layer (Part 13)
 * Detects potential sandwich attacks and front-running risks before placing orders.
 * Analyzes orderbook depth, spread, and recent trade patterns.
 */

import { sodex } from '../clients/sodex';

export interface MevRisk {
  asset: string;
  risk_level: 'safe' | 'low' | 'medium' | 'high';
  risk_score: number;     // 0-100
  warnings: string[];
  recommendations: string[];
  spread_pct: number;
  orderbook_depth_usd: number;
  large_order_ahead: boolean;
  recommended_order_type: 'market' | 'limit' | 'twap';
  max_safe_size_usd: number;
}

export async function checkMevRisk(
  symbol: string,
  side: 'buy' | 'sell',
  orderSizeUsd: number
): Promise<MevRisk> {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let riskScore = 0;

  let bid = 0;
  let ask = 0;
  let depthUsd = 0;
  let largeOrderAhead = false;

  try {
    const ob: any = await sodex.getSpotOrderbook(symbol, 20);
    const bids: [string, string][] = ob?.bids ?? ob?.bid ?? [];
    const asks: [string, string][] = ob?.asks ?? ob?.ask ?? [];

    if (bids.length > 0 && asks.length > 0) {
      bid = parseFloat(String(bids[0][0]));
      ask = parseFloat(String(asks[0][0]));

      // Spread check
      const spreadPct = bid > 0 ? ((ask - bid) / bid) * 100 : 0;
      if (spreadPct > 1.0) {
        riskScore += 30;
        warnings.push(`Wide spread detected: ${spreadPct.toFixed(3)}% (normal <0.1%)`);
        recommendations.push('Use limit orders to avoid crossing the wide spread');
      } else if (spreadPct > 0.3) {
        riskScore += 15;
        warnings.push(`Elevated spread: ${spreadPct.toFixed(3)}%`);
      }

      // Orderbook depth check
      const relevantOrders = side === 'buy' ? asks : bids;
      let cumDepth = 0;
      let priceImpact = 0;
      for (let i = 0; i < Math.min(10, relevantOrders.length); i++) {
        const price = parseFloat(String(relevantOrders[i][0]));
        const qty = parseFloat(String(relevantOrders[i][1]));
        const orderUsd = price * qty;
        cumDepth += orderUsd;
        if (cumDepth < orderSizeUsd && i > 0) {
          const firstPrice = parseFloat(String(relevantOrders[0][0]));
          priceImpact = Math.abs((price - firstPrice) / firstPrice) * 100;
        }
      }
      depthUsd = cumDepth;

      if (orderSizeUsd > depthUsd * 0.5) {
        riskScore += 35;
        warnings.push(`Your order (${(orderSizeUsd / 1000).toFixed(1)}k) is >50% of available liquidity. High price impact.`);
        recommendations.push(`Split into ≤3 smaller orders or use TWAP`);
        largeOrderAhead = true;
      } else if (orderSizeUsd > depthUsd * 0.2) {
        riskScore += 15;
        warnings.push(`Order size is >20% of liquidity depth. Moderate price impact expected.`);
        recommendations.push('Consider limit order at midpoint');
      }

      if (priceImpact > 1) {
        riskScore += 20;
        warnings.push(`Estimated price impact: ${priceImpact.toFixed(2)}% — significant slippage`);
      }

      // Check for suspicious large order near top of book
      if (relevantOrders.length > 1) {
        const topSize = parseFloat(String(relevantOrders[0][1]));
        const secondSize = parseFloat(String(relevantOrders[1][1]));
        if (topSize > secondSize * 5) {
          riskScore += 20;
          warnings.push('Suspicious large order at top of book — possible front-running wall');
          recommendations.push('Wait for this order to be filled or use limit order behind it');
          largeOrderAhead = true;
        }
      }
    }
  } catch { /* ignore */ }

  const spreadPct = bid > 0 && ask > 0 ? ((ask - bid) / bid) * 100 : 0;

  let riskLevel: MevRisk['risk_level'];
  if (riskScore >= 60) riskLevel = 'high';
  else if (riskScore >= 35) riskLevel = 'medium';
  else if (riskScore >= 15) riskLevel = 'low';
  else riskLevel = 'safe';

  if (riskLevel === 'safe') {
    recommendations.push('Orderbook looks clean — market order is safe');
  }

  const maxSafeSizeUsd = depthUsd > 0 ? depthUsd * 0.1 : orderSizeUsd;
  const recommendedOrderType: MevRisk['recommended_order_type'] =
    riskScore >= 60 ? 'twap' : riskScore >= 30 ? 'limit' : 'market';

  return {
    asset: symbol,
    risk_level: riskLevel,
    risk_score: Math.min(100, riskScore),
    warnings,
    recommendations,
    spread_pct: parseFloat(spreadPct.toFixed(4)),
    orderbook_depth_usd: parseFloat(depthUsd.toFixed(2)),
    large_order_ahead: largeOrderAhead,
    recommended_order_type: recommendedOrderType,
    max_safe_size_usd: parseFloat(maxSafeSizeUsd.toFixed(2)),
  };
}

export function formatMevWarning(risk: MevRisk): string {
  if (risk.risk_level === 'safe') return '';
  const emoji = { safe: '✅', low: '🟡', medium: '🟠', high: '🔴' }[risk.risk_level];
  const lines = [
    `${emoji} <b>MEV Risk: ${risk.risk_level.toUpperCase()}</b> (score: ${risk.risk_score}/100)`,
    '',
    ...risk.warnings.map(w => `⚠️ ${w}`),
    '',
    '💡 <b>Recommendations:</b>',
    ...risk.recommendations.map(r => `• ${r}`),
  ];
  return lines.join('\n');
}
