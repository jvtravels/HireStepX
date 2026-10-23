import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { LoginDesktop as LoginDesktop2 } from "../../../../../src/home2/AuthFrames";
import { SignupDesktop as SignupDesktop2 } from "../../../../../src/home2/AuthFrames";
import { LoginMobile as LoginMobile2 } from "../../../../../src/home2/AuthFrames";
import { SignupMobile as SignupMobile2 } from "../../../../../src/home2/AuthFrames";

export default function AuthCanvas() {
  return (
    <Canvas name="auth" backgroundColor="#232323">
      <Storyboard
        id="LoginDesktop"
        name="Login Desktop"
        component={LoginDesktop2}
        layout={{ x: 0, y: 0, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="SignupDesktop"
        name="Signup Desktop"
        component={SignupDesktop2}
        layout={{ x: 1490, y: 0, width: 1440, height: 900, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="LoginMobile"
        name="Login Mobile"
        component={LoginMobile2}
        layout={{ x: 0, y: 950, width: 390, height: 800, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="SignupMobile"
        name="Signup Mobile"
        component={SignupMobile2}
        layout={{ x: 0, y: 1800, width: 390, height: 900, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
