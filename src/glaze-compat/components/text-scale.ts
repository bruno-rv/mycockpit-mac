/* Text variant scale. Each variant maps to a single bundled utility (`text-<variant>`: size +
   weight + line-height) defined in styles.css — the named `--text-*` theme tokens and the
   `@source inline` force-generation list there must stay in sync with these keys.

   The variant name is the design-system size vocabulary (`small`, `large-strong`, …); the
   emitted class is `text-<variant>`. The `text-` prefix is Tailwind's category namespace and
   is an implementation detail — it lives only on the class, never on the public `variant` API. */
export const textVariantConfig = {
  heading1: { size: 24, lineHeight: 30, weight: 600, letterSpacing: -0.17 },
  heading2: { size: 18, lineHeight: 24, weight: 600, letterSpacing: -0.12 },
  "extra-large": { size: 18, lineHeight: 24, weight: 400, letterSpacing: -0.1 },
  "extra-large-strong": { size: 18, lineHeight: 24, weight: 500, letterSpacing: -0.11 },
  large: { size: 16, lineHeight: 22, weight: 400, letterSpacing: 0 },
  "large-strong": { size: 16, lineHeight: 22, weight: 500, letterSpacing: 0.01 },
  regular: { size: 13, lineHeight: 18, weight: 400, letterSpacing: 0.1 },
  strong: { size: 13, lineHeight: 18, weight: 500, letterSpacing: 0.11 },
  small: { size: 11, lineHeight: 14, weight: 400, letterSpacing: 0.1 },
  "small-strong": { size: 11, lineHeight: 14, weight: 500, letterSpacing: 0.11 },
  mini: { size: 8, lineHeight: 10, weight: 400, letterSpacing: 0.1 },
  "mini-strong": { size: 8, lineHeight: 10, weight: 500, letterSpacing: 0.11 },
  mono: { size: 13, lineHeight: 18, weight: 400, mono: true },
  "mono-strong": { size: 13, lineHeight: 18, weight: 600, mono: true },
  "small-mono": { size: 11, lineHeight: 14, weight: 400, mono: true },
} as const;

export type TextVariantName = keyof typeof textVariantConfig;

/** Class form of each variant (mono variants add the font family alongside the bundled utility). */
export const textVariantClasses = Object.fromEntries(
  Object.entries(textVariantConfig).map(([name, config]) => [
    name,
    `${"mono" in config && config.mono ? "font-mono " : ""}text-${name}`,
  ]),
) as Record<TextVariantName, string>;

/** Font size per variant — drives the playground scale table. */
export const textVariantSizes = Object.fromEntries(
  Object.entries(textVariantConfig).map(([name, config]) => [name, config.size]),
) as { [K in TextVariantName]: (typeof textVariantConfig)[K]["size"] };

/** Font-size token names (numeric and variant forms) — registered in `cn`'s tailwind-merge config. */
export const TEXT_FONT_SIZE_TOKENS: readonly string[] = [
  ...new Set(Object.values(textVariantConfig).map((config) => String(config.size))),
  ...Object.keys(textVariantConfig),
];
