import tempoNextjsPlugin from "tempo-sdk/nextjs/plugin";

const withTempo = tempoNextjsPlugin();

export default withTempo({
  reactStrictMode: true,
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
});
