import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import AnalyticsRounded from '@mui/icons-material/AnalyticsRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import HealthAndSafetyRounded from '@mui/icons-material/HealthAndSafetyRounded';
import LiveTvRounded from '@mui/icons-material/LiveTvRounded';
import PaymentsRounded from '@mui/icons-material/PaymentsRounded';
import PsychologyRounded from '@mui/icons-material/PsychologyRounded';
import RouteRounded from '@mui/icons-material/RouteRounded';
import SecurityRounded from '@mui/icons-material/SecurityRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import type { SvgIconComponent } from '@mui/icons-material';

export type ProductDomain = 'review' | 'profile' | 'plan' | 'card' | 'round' | 'strategy' | 'appointment' | 'live' | 'major' | 'support' | 'payment' | 'security' | 'ai' | 'system-health';

export const domainGlyphs: Record<ProductDomain, SvgIconComponent> = {
  review: FactCheckRounded,
  profile: AnalyticsRounded,
  plan: RouteRounded,
  card: CreditCardRounded,
  round: RouteRounded,
  strategy: PsychologyRounded,
  appointment: CalendarMonthRounded,
  live: LiveTvRounded,
  major: AccountBalanceWalletRounded,
  support: SupportAgentRounded,
  payment: PaymentsRounded,
  security: SecurityRounded,
  ai: PsychologyRounded,
  'system-health': HealthAndSafetyRounded,
};

export function DomainGlyph({ domain, label }: { domain: ProductDomain; label?: string }) {
  const Glyph = domainGlyphs[domain];
  return <Glyph aria-label={label} aria-hidden={label ? undefined : true} color="primary" />;
}
