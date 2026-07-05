import { Routes, Route, Navigate } from 'react-router-dom';
import { ConditionalLayout } from '@/components/ConditionalLayout';

import DashboardPage from '@/app/dashboard/page';
import LandingPage from '@/app/landing/page';
import DocsPage from '@/app/docs/page';
import AgentsPage from '@/app/agents/page';
import AlertsPage from '@/app/alerts/page';
import ArbitragePage from '@/app/arbitrage/page';
import LeaderboardPage from '@/app/leaderboard/page';
import MethodologyPage from '@/app/methodology/page';
import NewsletterPage from '@/app/newsletter/page';
import PersonaPage from '@/app/persona/page';
import PlaybookPage from '@/app/playbook/page';
import PortfolioPage from '@/app/portfolio/page';
import ProfilePage from '@/app/profile/page';
import RebalancePage from '@/app/rebalance/page';
import ResearchPage from '@/app/research/page';
import RoadmapPage from '@/app/roadmap/page';
import SectorsPage from '@/app/sectors/page';
import SettingsPage from '@/app/settings/page';
import SignalsPage from '@/app/signals/page';
import SignalDetailPage from '@/pages/SignalDetailPage';
import StatusPage from '@/app/status/page';
import StrategiesPage from '@/app/strategies/page';
import TrackRecordPage from '@/app/track-record/page';
import TradePage from '@/app/trade/page';
import TradeSignPage from '@/app/trade/sign/page';
import WhalesPage from '@/app/whales/page';

export default function App() {
  return (
    <ConditionalLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/arbitrage" element={<ArbitragePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/newsletter" element={<NewsletterPage />} />
        <Route path="/persona" element={<PersonaPage />} />
        <Route path="/playbook" element={<PlaybookPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/rebalance" element={<RebalancePage />} />
        <Route path="/research" element={<ResearchPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/sectors" element={<SectorsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/signals" element={<SignalsPage />} />
        <Route path="/signals/:id" element={<SignalDetailPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/strategies" element={<StrategiesPage />} />
        <Route path="/track-record" element={<TrackRecordPage />} />
        <Route path="/trade" element={<TradePage />} />
        <Route path="/trade/wizard" element={<Navigate to="/trade" replace />} />
        <Route path="/trade/sign" element={<TradeSignPage />} />
        <Route path="/whales" element={<WhalesPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ConditionalLayout>
  );
}
