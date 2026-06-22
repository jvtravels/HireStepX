import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';

const BASE = 'https://staging.hirestepx.com';
const OUT  = '/tmp/audit-full';
if (!existsSync(OUT)) mkdirSync(OUT);

const SHOTS = [
  // Full-page marketing
  { path: '/',        name: 'home',    vw: 1440, vh: 900,  full: true  },
  { path: '/',        name: 'home',    vw: 375,  vh: 812,  full: true  },
  { path: '/pricing', name: 'pricing', vw: 1440, vh: 900,  full: true  },
  { path: '/pricing', name: 'pricing', vw: 375,  vh: 812,  full: true  },
  { path: '/pricing', name: 'pricing', vw: 768,  vh: 1024, full: true  },
  // Auth surfaces — viewport-only (form is above fold)
  { path: '/login',   name: 'login',   vw: 1440, vh: 900,  full: false },
  { path: '/login',   name: 'login',   vw: 1024, vh: 768,  full: false },
  { path: '/login',   name: 'login',   vw: 375,  vh: 812,  full: false },
  { path: '/signup',  name: 'signup',  vw: 1440, vh: 900,  full: false },
  { path: '/signup',  name: 'signup',  vw: 375,  vh: 812,  full: false },
  // "How it works" section — scroll down on home
  { path: '/',        name: 'home-scroll', vw: 1440, vh: 900, full: false, scrollY: 900  },
  { path: '/',        name: 'home-scroll2', vw: 1440, vh: 900, full: false, scrollY: 1800 },
  { path: '/',        name: 'home-mobile-scroll', vw: 375, vh: 812, full: false, scrollY: 900 },
];

const browser = await chromium.launch();

for (const s of SHOTS) {
  const page = await browser.newPage();
  await page.setViewportSize({ width: s.vw, height: s.vh });
  await page.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  if (s.scrollY) await page.evaluate(y => window.scrollTo(0, y), s.scrollY);
  if (s.scrollY) await page.waitForTimeout(500);
  const fname = `${OUT}/${s.name}_${s.vw}x${s.vh}${s.scrollY ? `_y${s.scrollY}` : ''}.png`;
  await page.screenshot({ path: fname, fullPage: s.full });
  console.log(`✓ ${fname}`);
  await page.close();
}

await browser.close();
console.log('Done');
