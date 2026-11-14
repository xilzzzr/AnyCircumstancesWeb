// Pages that moved. The build writes a small HTML page at each old address
// that sends visitors and search engines to the new one (an instant meta
// refresh, which Google treats as a permanent redirect). The server can also
// redirect these directly; see deploy/PRERENDER_AND_CADDY.md.
export const redirects = [
  {
    from: "/guides/what-happens-to-bitcoin-when-you-die",
    to: "/guides/what-happens-to-crypto-when-you-die",
    title: "What Happens to Cryptocurrency When You Die?",
  },
];

const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function redirectPage({ to, title }, siteUrl) {
  const target = `${siteUrl}${to}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | AnyCircumstances</title>
  <link rel="canonical" href="${escapeHtml(target)}">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(to)}">
</head>
<body>
  <p>This guide has moved to <a href="${escapeHtml(to)}">${escapeHtml(title)}</a>.</p>
</body>
</html>
`;
}
