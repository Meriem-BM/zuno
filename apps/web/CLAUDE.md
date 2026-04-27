# apps/web/

Minimal landing page. Next.js 15 App Router, Tailwind v4, pnpm.

## Aesthetic constraints, these are not negotiable

- **Dark, refined, quiet.** Background `#0a0a0b`. Generous whitespace.
- **Soft pink accent: `#FF8FB1`.** Used sparingly, for one or two
  highlighted tokens in the terminal mock, the primary CTA, and at most
  one inline span per section.
- **Fonts:** Fraunces (display serif) + Geist Sans (body) +
  JetBrains Mono (terminal). Loaded via `next/font/google`. Don't add
  Inter, Space Grotesk, Roboto, or any system font fallback as the
  primary face.
- **No gradients, no glow, no shimmer.** No animated backgrounds. Subtle
  motion only, page-load stagger via `animation-delay`, nothing scroll-
  driven that distracts.
- **No emojis. No giant headlines. No "Built with [stack]" badges.**

If a change starts to feel "startup-loud" or "AI-generated," walk it
back. The reference vibes are: a printed monograph, Linear, the
Stripe docs of a few years ago, not a typical SaaS landing.

## Layout (App Router)

```
app/
  layout.tsx           # fonts, theme variables, root <html>
  page.tsx             # the only public page
  globals.css          # Tailwind v4 @theme block + grain texture
  components/          # Hero, Terminal, HowItWorks, WhyItMatters,
                       # Architecture, Footer, Nav
```

Tailwind v4 is configured via the CSS `@theme` block in `globals.css`;
there is no `tailwind.config.ts`. Custom colors and fonts live there.

## Animations

Defined in `globals.css` keyframes: `rise` (initial reveal stagger),
`blink` (terminal cursor), `axlpulse` (architecture diagram nodes).
That's the full motion budget. Don't add more without a reason.

## Routes

Single-page. The `View demo` CTA scrolls to `#demo`, `Read architecture`
to `#architecture`. No `/about`, `/pricing`, `/blog`, those would
contradict the aesthetic.

## When you change copy

- Hero H1 is fixed: *"A terminal-native copilot for Uniswap LPs."*
- Sub copy is fixed: *"Zuno uses a small network of AXL-connected agents
  to inspect positions, debate rebalances, and produce execution-ready
  liquidity plans."*
- Anything else is fair game, but keep it terse, whitespace > copy.
