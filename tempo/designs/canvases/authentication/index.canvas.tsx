import type { TempoPage, TempoStoryboard } from "tempo-sdk";
import CanvasProviders from "../../../CanvasProviders";
import Login from "./Login";
import Signup from "./Signup";

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
