"use client";
import { homeCss } from "./homeCss";
import { Nav, Closing, Footer } from "./Homepage";

const chromeCss = `
.hx-chrome-nav { position: sticky; top: 0; z-index: 50; }
.hx-chrome-nav .hx-nav { position: static; }
`;

export function Home2Nav() {
  return (
    <div className="hx hx-chrome-nav">
      <style>{homeCss}</style>
      <style>{chromeCss}</style>
      <Nav />
    </div>
  );
}

export function Home2Footer() {
  return (
    <div className="hx">
      <style>{homeCss}</style>
      <Closing />
      <Footer />
    </div>
  );
}
