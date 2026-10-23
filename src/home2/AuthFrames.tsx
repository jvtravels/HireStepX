import { LoginScreen, SignupScreen } from "./Auth";

const frame = (w: number, h: number, C: () => React.ReactElement) =>
  function Frame() {
    return <div style={{ width: w, height: h }}><C /></div>;
  };

export const LoginDesktop = frame(1440, 900, LoginScreen);
export const SignupDesktop = frame(1440, 900, SignupScreen);
export const LoginMobile = frame(390, 800, LoginScreen);
export const SignupMobile = frame(390, 900, SignupScreen);

import { ForgotPasswordScreen, ResetPasswordScreen } from "./Auth";

export const ForgotDesktop = frame(1440, 900, () => <ForgotPasswordScreen />);
export const ForgotSentDesktop = frame(1440, 900, () => <ForgotPasswordScreen initialSent email="priya.sharma@gmail.com" />);
export const ResetDesktop = frame(1440, 900, () => <ResetPasswordScreen />);
export const ResetExpiredDesktop = frame(1440, 900, () => <ResetPasswordScreen state="expired" />);
export const ResetUsedDesktop = frame(1440, 900, () => <ResetPasswordScreen state="used" />);
export const ResetDoneDesktop = frame(1440, 900, () => <ResetPasswordScreen state="done" />);
export const ForgotMobile = frame(390, 800, () => <ForgotPasswordScreen />);
export const ForgotSentMobile = frame(390, 800, () => <ForgotPasswordScreen initialSent email="priya.sharma@gmail.com" />);
export const ResetMobile = frame(390, 900, () => <ResetPasswordScreen />);
export const ResetExpiredMobile = frame(390, 800, () => <ResetPasswordScreen state="expired" />);
