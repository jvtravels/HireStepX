import { LoginScreen, SignupScreen } from "./Auth";

const frame = (w: number, h: number, C: () => React.ReactElement) =>
  function Frame() {
    return <div style={{ width: w, height: h }}><C /></div>;
  };

export const LoginDesktop = frame(1440, 900, LoginScreen);
export const SignupDesktop = frame(1440, 900, SignupScreen);
export const LoginMobile = frame(390, 800, LoginScreen);
export const SignupMobile = frame(390, 900, SignupScreen);
