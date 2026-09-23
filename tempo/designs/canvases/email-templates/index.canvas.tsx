import Authaccountemails from './AuthAccountEmails';
import Paymentemails from './PaymentEmails';
import Reengagementemails from './ReengagementEmails';
import Reportemails from './ReportEmails';
import Subscriptionemails from './SubscriptionEmails';
import { Canvas, Storyboard } from "tempo-sdk/canvas";

export default function EmailTemplatesCanvas() {
  return (
    <Canvas name="Email Templates">
      <Storyboard
        id="AuthAccount"
        name={"Auth & Account"}
        component={Authaccountemails}
        layout={{ x: 0, y: 0, width: 1280, height: 7800 }}
      />
      <Storyboard
        id="Payments"
        name={"Payments & Billing"}
        component={Paymentemails}
        layout={{ x: 1330, y: 0, width: 1280, height: 5200 }}
      />
      <Storyboard
        id="Subscription"
        name="Subscription Lifecycle"
        component={Subscriptionemails}
        layout={{ x: 0, y: 7850, width: 1280, height: 6100 }}
      />
      <Storyboard
        id="Reengagement"
        name="Re-engagement"
        component={Reengagementemails}
        layout={{ x: 0, y: 14000, width: 1280, height: 5400 }}
      />
      <Storyboard
        id="Reports"
        name={"Reports & Digests"}
        component={Reportemails}
        layout={{ x: 0, y: 19500, width: 1280, height: 3400 }}
      />
    </Canvas>
  );
}
