const filename = 'Clash.Verge_2.5.1_x64-setup.exe';
const size = 47_071_345;
const partPaths = [
  '/source/assets/clash-verge-2.5.1-x64.part1.bin',
  '/source/assets/clash-verge-2.5.1-x64.part2.bin',
];

const headers = {
  'Content-Type': 'application/octet-stream',
  'Content-Disposition': `attachment; filename="${filename}"`,
  'Content-Length': String(size),
  'Cache-Control': 'public, max-age=86400',
  'X-Content-Type-Options': 'nosniff',
};

export function onRequestHead() {
  return new Response(null, { headers });
}

export async function onRequestGet({ env, request, waitUntil }) {
  // Each part fits within the Pages static file limit. Serve them as one download.
  const parts = await Promise.all(
    partPaths.map((path) => env.ASSETS.fetch(new URL(path, request.url))),
  );

  if (parts.some((part) => !part.ok || !part.body)) {
    await Promise.all(parts.map((part) => part.body?.cancel()));
    return new Response('Installer temporarily unavailable.', { status: 503 });
  }

  const { readable, writable } = new FixedLengthStream(size);
  const [first, second] = parts;
  waitUntil(
    first.body.pipeTo(writable, { preventClose: true })
      .then(() => second.body.pipeTo(writable))
      .catch(() => second.body.cancel().catch(() => {})),
  );

  return new Response(readable, { headers });
}
