import CanvasProviders from "../../../CanvasProviders";
import Login from "./Login";
import Signup from "./Signup";
import ForgotPassword from "./ForgotPassword";
import ForgotPasswordSent from "./ForgotPasswordSent";
import ResetPassword from "./ResetPassword";
import ResetPasswordSuccess from "./ResetPasswordSuccess";
import { Canvas, Storyboard } from "tempo-sdk/canvas";

const LoginScreen = () => (
    <CanvasProviders>
      <Login />
    </CanvasProviders>
  );

const SignupScreen = () => (
    <CanvasProviders>
      <Signup />
    </CanvasProviders>
  );

/* Password recovery flow — 4 screens left-to-right reading order:
   1. Request → 2. Sent → 3. Set new → 4. Success */

const ForgotPasswordScreen = () => (
    <CanvasProviders>
      <ForgotPassword />
    </CanvasProviders>
  );

const ForgotPasswordSentScreen = () => (
    <CanvasProviders>
      <ForgotPasswordSent email="rahul@gmail.com" />
    </CanvasProviders>
  );

const ResetPasswordScreen = () => (
    <CanvasProviders>
      <ResetPassword email="rahul@gmail.com" />
    </CanvasProviders>
  );

const ResetPasswordExpiredScreen = () => (
    <CanvasProviders>
      <ResetPassword tokenStatus="expired" />
    </CanvasProviders>
  );

const ResetPasswordUsedScreen = () => (
    <CanvasProviders>
      <ResetPassword tokenStatus="used" />
    </CanvasProviders>
  );

const ResetPasswordInvalidScreen = () => (
    <CanvasProviders>
      <ResetPassword tokenStatus="invalid" />
    </CanvasProviders>
  );

const ResetPasswordSuccessScreen = () => (
    <CanvasProviders>
      <ResetPasswordSuccess />
    </CanvasProviders>
  );

/* ── State variants — error + loading + low-time-remaining ─────────────── */

const ForgotPasswordErrorScreen = () => (
    <CanvasProviders>
      <ForgotPassword error="Too many attempts. Try again in 5 minutes." />
    </CanvasProviders>
  );

const ForgotPasswordLoadingScreen = () => (
    <CanvasProviders>
      <ForgotPassword initialEmail="rahul@gmail.com" loading />
    </CanvasProviders>
  );

const ForgotPasswordSentResendingScreen = () => (
    <CanvasProviders>
      <ForgotPasswordSent email="rahul@gmail.com" resending />
    </CanvasProviders>
  );

const ResetPasswordErrorScreen = () => (
    <CanvasProviders>
      <ResetPassword
        email="rahul@gmail.com"
        error="That password was used recently. Pick a different one."
      />
    </CanvasProviders>
  );

const ResetPasswordLoadingScreen = () => (
    <CanvasProviders>
      <ResetPassword email="rahul@gmail.com" loading />
    </CanvasProviders>
  );

const ResetPasswordLowTimeScreen = () => (
    <CanvasProviders>
      {/* 0.1 min ≈ 6 seconds — exercises the countdown's near-zero state */}
      <ResetPassword email="rahul@gmail.com" expiryMinutes={0.1} />
    </CanvasProviders>
  );

export default function AuthenticationCanvas() {
  return (
    <Canvas name="Authentication">
      <Storyboard
        id="LoginScreen"
        name="Login"
        component={LoginScreen}
        layout={{ x: 0, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="SignupScreen"
        name="Signup"
        component={SignupScreen}
        layout={{ x: 1490, y: 0, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ForgotPasswordScreen"
        name="Forgot password"
        component={ForgotPasswordScreen}
        layout={{ x: 0, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ForgotPasswordSentScreen"
        name="Forgot password — sent"
        component={ForgotPasswordSentScreen}
        layout={{ x: 1490, y: 1074, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordScreen"
        name="Reset password"
        component={ResetPasswordScreen}
        layout={{ x: 0, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordExpiredScreen"
        name="Reset password — expired link"
        component={ResetPasswordExpiredScreen}
        layout={{ x: 1490, y: 2148, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordUsedScreen"
        name="Reset password — link already used"
        component={ResetPasswordUsedScreen}
        layout={{ x: 0, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordInvalidScreen"
        name="Reset password — link invalid"
        component={ResetPasswordInvalidScreen}
        layout={{ x: 1490, y: 3222, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordSuccessScreen"
        name="Reset password — success"
        component={ResetPasswordSuccessScreen}
        layout={{ x: 0, y: 4296, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ForgotPasswordErrorScreen"
        name="Forgot password — server error"
        component={ForgotPasswordErrorScreen}
        layout={{ x: 1490, y: 4296, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ForgotPasswordLoadingScreen"
        name="Forgot password — loading"
        component={ForgotPasswordLoadingScreen}
        layout={{ x: 0, y: 5370, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ForgotPasswordSentResendingScreen"
        name="Forgot password — sent (resending)"
        component={ForgotPasswordSentResendingScreen}
        layout={{ x: 1490, y: 5370, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordErrorScreen"
        name="Reset password — server error"
        component={ResetPasswordErrorScreen}
        layout={{ x: 0, y: 6444, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordLoadingScreen"
        name="Reset password — loading"
        component={ResetPasswordLoadingScreen}
        layout={{ x: 1490, y: 6444, width: 1440, height: 1024 }}
      />
      <Storyboard
        id="ResetPasswordLowTimeScreen"
        name="Reset password — almost expired"
        component={ResetPasswordLowTimeScreen}
        layout={{ x: 0, y: 7518, width: 1440, height: 1024 }}
      />
    </Canvas>
  );
}
