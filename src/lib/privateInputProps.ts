// Hints reduce browser/extension capture; they cannot control a compromised device.
export const privateInputProps = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "none",
  spellCheck: false,
  "data-lpignore": "true",
  "data-1p-ignore": true,
  "data-private": true,
  "data-hj-suppress": true,
  "data-clarity-mask": "true",
  "data-sentry-mask": true,
  "data-gramm": "false",
  "data-gramm_editor": "false",
  "data-enable-grammarly": "false",
} as const;
