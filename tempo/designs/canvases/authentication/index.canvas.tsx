import type { TempoPage, TempoStoryboard } from "tempo-sdk";
import CanvasProviders from "../../../CanvasProviders";
import Login from "./Login";
import Signup from "./Signup";
import ForgotPassword from "./ForgotPassword";
import ForgotPasswordSent from "./ForgotPasswordSent";
import ResetPassword from "./ResetPassword";
import ResetPasswordSuccess from "./ResetPasswordSuccess";

const page: TempoPage = {
  name: "Authentication",
};

export default page;

export const LoginScreen: TempoStoryboard = {
  name: "Login",
  render: () => (
    <CanvasProviders>
      <Login />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 0, width: 1440, height: 1024 },
};

export const SignupScreen: TempoStoryboard = {
  name: "Signup",
  render: () => (
    <CanvasProviders>
      <Signup />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 0, width: 1440, height: 1024 },
};

/* Password recovery flow — 4 screens left-to-right reading order:
   1. Request → 2. Sent → 3. Set new → 4. Success */

export const ForgotPasswordScreen: TempoStoryboard = {
  name: "Forgot password",
  render: () => (
    <CanvasProviders>
      <ForgotPassword />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 1074, width: 1440, height: 1024 },
};

export const ForgotPasswordSentScreen: TempoStoryboard = {
  name: "Forgot password — sent",
  render: () => (
    <CanvasProviders>
      <ForgotPasswordSent email="rahul@gmail.com" />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 1074, width: 1440, height: 1024 },
};

export const ResetPasswordScreen: TempoStoryboard = {
  name: "Reset password",
  render: () => (
    <CanvasProviders>
      <ResetPassword email="rahul@gmail.com" />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 2148, width: 1440, height: 1024 },
};

export const ResetPasswordExpiredScreen: TempoStoryboard = {
  name: "Reset password — expired link",
  render: () => (
    <CanvasProviders>
      <ResetPassword tokenStatus="expired" />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 2148, width: 1440, height: 1024 },
};

export const ResetPasswordUsedScreen: TempoStoryboard = {
  name: "Reset password — link already used",
  render: () => (
    <CanvasProviders>
      <ResetPassword tokenStatus="used" />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 3222, width: 1440, height: 1024 },
};

export const ResetPasswordInvalidScreen: TempoStoryboard = {
  name: "Reset password — link invalid",
  render: () => (
    <CanvasProviders>
      <ResetPassword tokenStatus="invalid" />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 3222, width: 1440, height: 1024 },
};

export const ResetPasswordSuccessScreen: TempoStoryboard = {
  name: "Reset password — success",
  render: () => (
    <CanvasProviders>
      <ResetPasswordSuccess />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 4296, width: 1440, height: 1024 },
};

/* ── State variants — error + loading + low-time-remaining ─────────────── */

export const ForgotPasswordErrorScreen: TempoStoryboard = {
  name: "Forgot password — server error",
  render: () => (
    <CanvasProviders>
      <ForgotPassword error="Too many attempts. Try again in 5 minutes." />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 4296, width: 1440, height: 1024 },
};

export const ForgotPasswordLoadingScreen: TempoStoryboard = {
  name: "Forgot password — loading",
  render: () => (
    <CanvasProviders>
      <ForgotPassword initialEmail="rahul@gmail.com" loading />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 5370, width: 1440, height: 1024 },
};

export const ForgotPasswordSentResendingScreen: TempoStoryboard = {
  name: "Forgot password — sent (resending)",
  render: () => (
    <CanvasProviders>
      <ForgotPasswordSent email="rahul@gmail.com" resending />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 5370, width: 1440, height: 1024 },
};

export const ResetPasswordErrorScreen: TempoStoryboard = {
  name: "Reset password — server error",
  render: () => (
    <CanvasProviders>
      <ResetPassword
        email="rahul@gmail.com"
        error="That password was used recently. Pick a different one."
      />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 6444, width: 1440, height: 1024 },
};

export const ResetPasswordLoadingScreen: TempoStoryboard = {
  name: "Reset password — loading",
  render: () => (
    <CanvasProviders>
      <ResetPassword email="rahul@gmail.com" loading />
    </CanvasProviders>
  ),
  layout: { x: 1490, y: 6444, width: 1440, height: 1024 },
};

export const ResetPasswordLowTimeScreen: TempoStoryboard = {
  name: "Reset password — almost expired",
  render: () => (
    <CanvasProviders>
      {/* 0.1 min ≈ 6 seconds — exercises the countdown's near-zero state */}
      <ResetPassword email="rahul@gmail.com" expiryMinutes={0.1} />
    </CanvasProviders>
  ),
  layout: { x: 0, y: 7518, width: 1440, height: 1024 },
};
