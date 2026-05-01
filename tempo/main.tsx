import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import TempoHost from "./.tempo/tempo-host";
import App from "./App";

const isTempoHostRoute =
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/tempo-host");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isTempoHostRoute ? <TempoHost /> : <App />}
  </StrictMode>,
);
