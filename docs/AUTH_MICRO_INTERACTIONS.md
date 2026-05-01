# HireStepX — Auth Screens: Micro-Interaction Specs

> Created: 2026-04-28 Owner: Founder / Design lead Scope: ONLY the 7 auth screens — implementation-ready specs Linked: `docs/AUTH_SCREENS_INSPIRATION.md`

Every interactive element on the 7 auth screens, with **exact**trigger / effect / timing / easing. Engineers can implement directly from this. Designers can prototype directly from this.

---

## Universal Foundation

### Easing functions (use these, not browser defaults)

```css
/* Add to your global stylesheet */
:root {
  --ease-out-expo:    cubic-bezier(0.16, 1, 0.3, 1);    /* Decelerating, premium feel */
  --ease-out-quart:   cubic-bezier(0.25, 1, 0.5, 1);    /* Snappy decelerate */
  --ease-in-out-cubic: cubic-bezier(0.65, 0, 0.35, 1); /* Symmetric */
  --ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1); /* Subtle overshoot */
  --ease-error:       cubic-bezier(0.36, 0.07, 0.19, 0.97); /* Shake feel */
}
```

### Timing tiers (consistency rule)

| Tier | Duration | Use for |
| --- | --- | --- |
| **Instant** | 80ms | Hover-state changes, ripples |
| **Fast** | 160ms | Focus rings, color transitions |
| **Standard** | 240ms | Button states, error appearances |
| **Smooth** | 320ms | Form-field state changes |
| **Page** | 400ms | Page transitions, drawer slides |
| **Reveal** | 600ms | Hero entrance, success states |

### Reduced motion (must respect)

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

For animations that *convey meaning* (success checkmark), keep them but cap at 100ms.

---

## 1. Page Load (every screen)

### 1.1 Hero text — staggered word reveal

**Trigger:** Page first paint (after font-load complete to avoid FOUC) **Effect:**

- Each word starts at `opacity: 0, translateY(8px)`
- Animates to `opacity: 1, translateY(0)`
- 50ms delay between words

**Spec:**

```css
.hero-word {
  opacity: 0;
  transform: translateY(8px);
  animation: heroReveal 480ms var(--ease-out-expo) forwards;
}
.hero-word:nth-child(1) { animation-delay: 0ms; }
.hero-word:nth-child(2) { animation-delay: 50ms; }
.hero-word:nth-child(3) { animation-delay: 100ms; }
.hero-word:nth-child(4) { animation-delay: 150ms; }
@keyframes heroReveal { to { opacity: 1; transform: translateY(0); } }
```

### 1.2 Italic accent word — color delay

**Trigger:** After 1.1 completes (≈350ms) **Effect:** The italicized accent word transitions color from black → orange

- Duration: 480ms, ease-out-expo
- Subtle "discovery" beat

```css
.hero-accent {
  color: #1a1614; /* warm dark */
  transition: color 480ms var(--ease-out-expo) 350ms;
}
.hero-accent.loaded {
  color: #B5470F; /* burnt orange */
}
```

### 1.3 Form fade-in

**Trigger:** 200ms after hero starts revealing **Effect:** Form container fades from `opacity: 0, translateY(12px)` → `opacity: 1, translateY(0)` over 480ms

### 1.4 Footer fade-in

**Trigger:** 400ms after page load **Effect:** Soft 320ms opacity 0 → 1

---

## 2. Inputs (Email, Password, Confirm Password)

### 2.1 Default state

- Border: `1px solid c.border` (current)
- Background: `#FFFFFF`
- Transition: `all 160ms var(--ease-fast)`

### 2.2 Hover (no focus yet)

**Trigger:** Mouse enter input **Effect:** Border darkens slightly

```css
.input:hover { border-color: c.stone; }
```

### 2.3 Focus

**Trigger:** Click or Tab into input **Effect:** 3-layer change:

1. Border → `c.indigo` (160ms)
2. Outline → 3px halo at `rgba(42, 30, 120, 0.12)` (160ms)
3. Background → very subtle warming `#FAFAF8` (160ms)

```css
.input:focus {
  border-color: c.indigo;
  box-shadow: 0 0 0 3px rgba(42, 30, 120, 0.12);
  background: #FAFAF8;
  outline: none;
}
```

### 2.4 Typing — live validation feedback (email)

**Trigger:** User types, debounced 400ms after last keystroke **Effect:**

- If valid: tiny ✓ icon fades in inside the field (right side, 16px from edge)
  - 200ms fade-in, scale from 0.6 → 1.0 with ease-spring
- If invalid: no visual yet (don't punish mid-type)

### 2.5 Blur with invalid value

**Trigger:** Tab/click out, value invalid **Effect:**

- Border → `c.ember` (red) over 160ms
- Error text appears below: `opacity 0 → 1` + `translateY(-4px) → 0` over 240ms
- **Subtle** — no shake on blur, only on submit failure

### 2.6 Autofill (browser-saved credentials)

**Trigger:** Browser auto-fills the field **Effect:** Background flash to `#FFF8E1` (yellow tint) for 240ms, then normal

- Combined with `:-webkit-autofill { background: white !important; }` to override Chrome's default green

### 2.7 Show/Hide password toggle (eye icon)

**Trigger:** Click eye icon **Effect:**

- Icon morphs eye → eye-off (or vice-versa) with 200ms cross-fade
- Password field type: `password` ↔ `text`
- **Auto-hide after 5 seconds** (security pattern)
- Subtle visual cue: small dot pulses next to the icon during the visible window

**Spec:**

```ts
const [visible, setVisible] = useState(false);
useEffect(() => {
  if (!visible) return;
  const t = setTimeout(() => setVisible(false), 5000);
  return () => clearTimeout(t);
}, [visible]);
```

### 2.8 Caps Lock detected (password fields)

**Trigger:** `keyup` event detects `event.getModifierState('CapsLock')`**Effect:**

- Subtle warning text below the password field: "⚠ Caps Lock is on"
- Fade in over 160ms
- Disappears the moment Caps Lock turns off (also 160ms)

---

## 3. Password Strength + Requirements (Signup, Create New Password)

### 3.1 Strength bar

**Trigger:** Every keystroke in password field **Effect:** A 4-segment bar below the input animates width + color

```ts
import zxcvbn from 'zxcvbn';
const score = zxcvbn(password).score; // 0-4
// 0: empty/very weak (red)
// 1: weak (red)
// 2: fair (orange)
// 3: good (yellow)
// 4: strong (green)
```

**Visual:**

```css
.strength-bar {
  height: 4px;
  background: rgba(0,0,0,0.06);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}
.strength-fill {
  height: 100%;
  width: 0;
  border-radius: 2px;
  transition: width 320ms var(--ease-out-expo), background-color 240ms ease;
}
/* score 0 → width: 0%, color: transparent */
/* score 1 → width: 25%, color: c.ember */
/* score 2 → width: 50%, color: orange */
/* score 3 → width: 75%, color: yellow */
/* score 4 → width: 100%, color: c.sage */
```

**Label text:** "Weak" / "Fair" / "Good" / "Strong" — fades + slides in below bar (160ms)

### 3.2 Requirement checks (live)

**Trigger:** Every keystroke **Effect:** Each requirement (8+ chars, uppercase, number, special) toggles independently

- Default: gray check icon (`c.stone`)
- On meeting condition:
  - Color: gray → green over 200ms
  - Scale: tiny bounce — `1 → 1.15 → 1` over 240ms with ease-spring
  - Subtle haptic-feel pulse

```css
.req-check {
  color: c.stone;
  transition: color 200ms ease;
}
.req-check.met {
  color: c.sage;
  animation: checkBounce 240ms var(--ease-spring);
}
@keyframes checkBounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
```

### 3.3 Password match indicator (Create New Password)

**Trigger:** Both fields have content + match **Effect:**

- "Passwords match" text fades in below confirm field (200ms)
- Tiny green ✓ next to it
- If they don't match: subtle gray text "Passwords don't match yet" (no red until submit attempt)

---

## 4. Buttons

### 4.1 Primary CTA (Continue, Send reset link, Save new password, Create account)

**Default:** Indigo background, white text, no shadow

**Hover:**

- Background: `indigo` → `indigo-darker` (5% darker)
- Box-shadow: appears at `0 4px 12px rgba(42, 30, 120, 0.18)`
- Slight scale: `1 → 1.005`
- Duration: 200ms ease-out

**Active (mousedown):**

- Scale: `1.005 → 0.98`
- Shadow: reduces to `0 2px 6px rgba(42, 30, 120, 0.12)`
- Duration: 80ms

**Focus (keyboard):**

- 3px halo outside button: `0 0 0 3px rgba(42, 30, 120, 0.25)`
- Duration: 160ms

**Disabled:**

- Opacity: 0.5
- Cursor: not-allowed
- No hover effects
- Subtle text "Fill all fields to continue" appears above (or tooltip on hover)

**Loading (after click):**

- Text fades out (120ms)
- Spinner fades in centered (120ms)
- Button stays at hover-state width to prevent layout shift
- Spinner: 16px, 1.5px stroke, rotates 360° in 800ms infinite

**Success:**

- Spinner fades out (120ms)
- Green ✓ fades in (160ms)
- Brief 400ms pause
- Page transition begins

**Error:**

- Loading state ends
- Button shakes horizontally
  - Keyframes: `0%, 100%: 0; 25%: -6px; 50%: 6px; 75%: -3px;`
  - Duration: 320ms ease-error
- Error text appears below form (240ms slide+fade)

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
}
```

### 4.2 Secondary button (Continue with Google)

**Default:** White background, dark text, subtle border

**Hover:**

- Background: `white → #FAFAF8` (subtle warm)
- Box-shadow: `0 1px 3px rgba(0,0,0,0.04)` → `0 4px 12px rgba(0,0,0,0.08)`
- Slight lift: `translateY(-1px)`
- Duration: 200ms ease-out

**Click:**

- `translateY(-1px) → translateY(0)`
- Shadow returns to default
- Duration: 80ms

**Loading:**

- Google logo briefly grayscales (visual: "we're working")
- Replace with spinner if redirect doesn't happen in 600ms

### 4.3 Tertiary text links (Forgot password, Resend link, Sign up, Log in)

**Hover:**

- Underline slides in left → right
- Duration: 200ms ease-out

```css
.text-link {
  background-image: linear-gradient(c.indigo, c.indigo);
  background-size: 0 1px;
  background-position: 0 100%;
  background-repeat: no-repeat;
  transition: background-size 200ms ease-out;
}
.text-link:hover {
  background-size: 100% 1px;
}
```

### 4.4 "Resend link" with cooldown

**Trigger:** Click after disabled-cooldown period **Effect:**

- Click: button shows quick green flash + "Sent!" text (240ms)
- Then: text changes to "Resend in 60s" with countdown
- Button disabled for 60s, opacity 0.5
- Countdown updates every second, ticking down
- After 60s: opacity returns to 1, text returns to "Resend link"

---

## 5. Checkbox (Remember for 30 days / Stay signed in)

**Default:** Empty box, 16px

**Hover:**

- Border darkens: `c.border → c.stone` (160ms)
- Subtle background: `transparent → rgba(0,0,0,0.02)`

**Checked:**

- Background fill: indigo (160ms)
- Tick icon draws in (SVG path animation, 240ms ease-out)
- Tiny scale bounce on check: `1 → 1.1 → 1` (200ms)

```svg
<svg viewBox="0 0 16 16">
  <path d="M3 8L7 12L13 4" 
        stroke="white" stroke-width="2" fill="none"
        stroke-dasharray="20" stroke-dashoffset="20"
        style="transition: stroke-dashoffset 240ms ease-out" />
</svg>
```

When checked, set `stroke-dashoffset: 0`.

---

## 6. Errors (toast + inline)

### 6.1 Inline field error

**Trigger:** Submit attempt with invalid field, OR blur with invalid **Effect:**

- Field border: `c.border → c.ember` over 160ms
- Error text below appears: `opacity 0, translateY(-4px) → opacity 1, translateY(0)` over 240ms
- On focus return: subtle border resets to indigo (focus state)

### 6.2 Form-level error

**Trigger:** Server rejects submit (wrong password, network error) **Effect:**

- Red banner above form: slides down + fades in (320ms)
- Auto-dismiss after 6 seconds (fade out 240ms)
- Has close (×) button — manual dismiss with 160ms fade

```css
.error-banner {
  background: rgba(196, 80, 80, 0.08);
  border: 1px solid rgba(196, 80, 80, 0.2);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  animation: bannerSlide 320ms var(--ease-out-expo);
}
@keyframes bannerSlide {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 6.3 Submit-failure shake (button)

See 4.1 Error state above.

---

## 7. Success Animations

### 7.1 Form submission success → Page transition

**Trigger:** Server returns 200 from CTA submit **Effect:**

- Button → green ✓ (200ms)
- 400ms pause
- Whole page: fade out + slight scale `1 → 1.02` over 320ms
- Next page: fade in + scale from 0.98 → 1 over 320ms
- Total perceived transition: \~1 second of "smooth completion"

### 7.2 "Email sent" envelope (Check-email screens)

**Trigger:** Page load **Effect:** A subtle envelope/paper-airplane icon

**Option A: Floating envelope**

```css
.envelope {
  animation: float 4s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
```

**Option B: Paper airplane (one-shot)**

- Plane SVG starts off-screen-left, scale 0.8
- Animates: `translateX(-200px) scale(0.8) → translateX(0) scale(1)` over 600ms ease-out-expo
- 200ms after landing, plane fades + transforms into static envelope icon

Option B is more delightful but only on first load. Option A is the steady state.

---

## 8. Top-Right Link

**Default:** Subtle gray text + indigo accent on the action word

**Hover:**

- Text color shift: gray → darker (160ms)
- Indigo word: stays indigo
- No underline (you have this right)

**Click:**

- Standard page transition

---

## 9. Logo (Top-Left)

**Hover:**

- Subtle scale: `1 → 1.02` (160ms)
- Cursor: pointer
- No color change (logo is identity, not state)

**Click:**

- Returns to landing page

---

## 10. Specific Screen-Level Sequences

### Login screen — full first-load timeline

| Time | Event |
| --- | --- |
| 0ms | Page paints, hero word 1 starts revealing |
| 50ms | Hero word 2 starts |
| 100ms | Hero word 3 starts |
| 150ms | Hero word 4 starts |
| 200ms | Subhead fades in |
| 350ms | Italic accent word transitions to orange |
| 400ms | Form container fades in |
| 600ms | Footer fades in |
| 800ms | Email input auto-focuses (cursor blinks) |

### Reset password (success after submit)

| Time | Event |
| --- | --- |
| 0ms | User clicks "Send reset link" |
| 80ms | Button click feedback (scale 0.98) |
| 120ms | Button text fades to spinner |
| \~600ms | Server responds 200 |
| 720ms | Spinner → green check |
| 1120ms | Page begins fade-out transition |
| 1440ms | Check Email screen begins fade-in |
| 1760ms | Envelope animation begins on new screen |

### Create new password (typing journey)

- User types "p" → strength bar at 25% (red, "Very weak")
- User types "password" → strength bar at 25% (red, dictionary word)
- User types "Passw0rd" → 50% (orange, "Fair") + 3 of 4 reqs go green
- User types "Passw0rd!" → 75% (yellow, "Good") + 4/4 reqs all green
- User types "Pa$$w0rd!23" → 100% (green, "Strong")

Each requirement that turns green: 240ms scale-bounce + color shift. Bar width: 320ms ease-out-expo. Label text: 200ms cross-fade.

---

## 11. Mobile-Specific Micro-Interactions

### Touch states (tap doesn't have hover)

- Replace hover effects with `:active` only
- Add subtle haptic feedback on form submission (use `navigator.vibrate(10)` — 10ms tap)
- iOS smooth scroll: `-webkit-overflow-scrolling: touch`

### Keyboard appearance handling

- When mobile keyboard opens, smoothly scroll the active input above the keyboard
- Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` on focus
- Body padding adjusts to keep CTA visible

### Pull-to-refresh prevention

- On forms, disable pull-to-refresh (`overscroll-behavior: contain`)
- Prevents accidental data loss

---

## 12. Loading & Skeleton States

### Initial page load

- If page takes &gt;300ms to render, show a subtle skeleton (don't show on fast loads)
- Cream background pulse: `rgba(245, 242, 237, 0.6) → rgba(245, 242, 237, 1)` over 1.2s loop

### Auth-init wait

- "Continue with Google" → after click, show inline spinner replacing the Google logo for \~500ms while OAuth redirects
- Prevents users from clicking twice

---

## 13. Library / Implementation Notes

### Recommended packages

- **Animation:** Framer Motion (`framer-motion`) — already plays nicely with React 19
- **Password strength:** `zxcvbn` (Dropbox's lib, accurate)
- **Confetti / one-shot:** `canvas-confetti` (only for "account created" celebration if you want one)
- **Icons:** Lucide (clean, animatable SVG paths)

### Framer Motion examples

**Hero word reveal:**

```tsx
import { motion } from 'framer-motion';

const HeroText = ({ text }) => (
  <motion.h1>
    {text.split(' ').map((word, i) => (
      <motion.span
        key={i}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05, duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      >
        {word}{' '}
      </motion.span>
    ))}
  </motion.h1>
);
```

**Button shake on error:**

```tsx
<motion.button
  animate={hasError ? 'shake' : 'idle'}
  variants={{
    idle: { x: 0 },
    shake: { x: [-6, 6, -3, 0], transition: { duration: 0.32 } },
  }}
>
  Continue
</motion.button>
```

**Strength bar:**

```tsx
<motion.div
  className="strength-fill"
  animate={{ width: `${score * 25}%` }}
  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
  style={{ background: scoreColors[score] }}
/>
```

---

## 14. Don't Do These Things

❌ **Bouncing buttons that never settle** — premium feel ≠ playful ❌ **Long fade-in over 600ms** — feels sluggish on every interaction ❌ **Background-color animations on inputs while typing** — distracting ❌ **Auto-shake on every blur** — only shake on submit-failure ❌ **Auto-focus on every interactive thing** — only on the first input of a fresh form ❌ **Confetti on signup** — too playful for premium editorial brand ❌ **Sound effects** — never. Save for actually rewarding moments later ❌ **Parallax on auth** — clashes with focus task

---

## 15. Test Checklist (Before Shipping)

- [ ] All animations &lt; 480ms (no laggy feel)

- [ ] All buttons have visible focus rings (keyboard-only test)

- [ ] All animations respect `prefers-reduced-motion`

- [ ] Tab order makes sense without mouse

- [ ] Mobile: no animation drops frames on iPhone SE / mid-range Android

- [ ] First Input Delay (FID) &lt; 100ms — animations don't block interaction

- [ ] Cumulative Layout Shift (CLS) &lt; 0.1 — no jumping content

- [ ] All loading states have spinners, not just disabled buttons

- [ ] Errors recover gracefully without page reload

- [ ] Browser autofill doesn't break visual consistency

- [ ] Color contrast still passes during animation peaks

- [ ] No animations interrupt screen reader announcements

---

## 16. The 5 Highest-Impact Micro-Interactions to Build First

If bandwidth is tight, these 5 alone shift you from "static design" to "felt premium":

1. **Hero staggered word reveal** (1 hour, used on all 7 screens)
2. **Input focus state** (border + halo + bg shift) (1 hour, used everywhere)
3. **Primary CTA hover + loading + shake** (2 hours, used on every screen)
4. **Live password strength + requirements** (3 hours, signup + create new password)
5. **"Email sent" envelope animation** (1 hour, both check-email screens)

**Total: \~8 hours to dramatically lift perceived quality.**