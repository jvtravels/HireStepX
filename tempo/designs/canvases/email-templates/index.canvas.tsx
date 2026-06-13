import type { TempoPage, TempoStoryboard, TempoRouteStoryboard } from 'tempo-sdk';
import Authaccountemails from './AuthAccountEmails';
import Paymentemails from './PaymentEmails';
import Reengagementemails from './ReengagementEmails';
import Reportemails from './ReportEmails';
import Subscriptionemails from './SubscriptionEmails';

const page: TempoPage = {
  name: "Email Templates",
};

export default page;

export const AuthAccount: TempoStoryboard = {
  render: () => <Authaccountemails />,
  name: "Auth & Account",
  layout: { x: 0, y: 0, width: 1280, height: 7800 },
};

export const Payments: TempoStoryboard = {
  render: () => <Paymentemails />,
  name: "Payments & Billing",
  layout: { x: 1330, y: 0, width: 1280, height: 5200 },
};

export const Subscription: TempoStoryboard = {
  render: () => <Subscriptionemails />,
  name: "Subscription Lifecycle",
  layout: { x: 0, y: 7850, width: 1280, height: 6100 },
};

export const Reengagement: TempoStoryboard = {
  render: () => <Reengagementemails />,
  name: "Re-engagement",
  layout: { x: 0, y: 14000, width: 1280, height: 5400 },
};

export const Reports: TempoStoryboard = {
  render: () => <Reportemails />,
  name: "Reports & Digests",
  layout: { x: 0, y: 19500, width: 1280, height: 3400 },
};
