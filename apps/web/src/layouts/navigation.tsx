import AccountBalanceWalletRounded from '@mui/icons-material/AccountBalanceWalletRounded';
import AccountCircleRounded from '@mui/icons-material/AccountCircleRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import CreditCardRounded from '@mui/icons-material/CreditCardRounded';
import CreditScoreRounded from '@mui/icons-material/CreditScoreRounded';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import FlagRounded from '@mui/icons-material/FlagRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import HelpRounded from '@mui/icons-material/HelpRounded';
import ManageSearchRounded from '@mui/icons-material/ManageSearchRounded';
import SupportAgentRounded from '@mui/icons-material/SupportAgentRounded';
import TaskAltRounded from '@mui/icons-material/TaskAltRounded';
import VideoCallRounded from '@mui/icons-material/VideoCallRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import TuneRounded from '@mui/icons-material/TuneRounded';
import RateReviewRounded from '@mui/icons-material/RateReviewRounded';
import type { SvgIconComponent } from '@mui/icons-material';

export type NavigationItem = { label: string; path: string; icon: SvgIconComponent };
export const clientNavigation: NavigationItem[] = [
  { label: 'Overview', path: '/client/overview', icon: DashboardRounded },
  { label: 'Credit Profile', path: '/client/credit-profile', icon: CreditScoreRounded },
  { label: 'Credit Readiness', path: '/client/readiness', icon: FactCheckRounded },
  { label: 'Credit Applications', path: '/client/application-rounds', icon: TaskAltRounded },
  { label: 'Goals', path: '/client/goals', icon: FlagRounded },
  { label: 'Cards', path: '/client/cards', icon: CreditCardRounded },
  { label: 'Services', path: '/client/services', icon: AccountBalanceWalletRounded },
  { label: 'Documents', path: '/client/documents', icon: DescriptionRounded },
  { label: 'Support', path: '/client/support', icon: HelpRounded },
  { label: 'Account', path: '/client/account', icon: AccountCircleRounded },
];
export const consultantNavigation: NavigationItem[] = [
  { label: 'Dashboard', path: '/consultant/dashboard', icon: DashboardRounded },
  { label: 'Clients', path: '/consultant/clients', icon: GroupsRounded },
  { label: 'Reviews', path: '/consultant/reviews', icon: RateReviewRounded },
  { label: 'Work Queue', path: '/consultant/work-queue', icon: TaskAltRounded },
  { label: 'Services', path: '/consultant/services', icon: AccountBalanceWalletRounded },
  { label: 'Sessions', path: '/consultant/sessions', icon: VideoCallRounded },
  { label: 'Card Research', path: '/consultant/card-research', icon: ManageSearchRounded },
  { label: 'Credit Readiness', path: '/consultant/readiness', icon: FactCheckRounded },
  { label: 'Calendar', path: '/consultant/calendar', icon: CalendarMonthRounded },
  { label: 'Support', path: '/consultant/support', icon: SupportAgentRounded },
  { label: 'Administration', path: '/consultant/administration', icon: TuneRounded },
];
