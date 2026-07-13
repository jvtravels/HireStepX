import tempoNextjsPlugin from "tempo-sdk/nextjs/plugin";
import { fileURLToPath } from "node:url";

const withTempo = tempoNextjsPlugin();

export default withTempo({
  reactStrictMode: true,
  outputFileTracingRoot: fileURLToPath(new URL("..", import.meta.url)),
});
