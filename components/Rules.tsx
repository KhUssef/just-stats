import { NETWORK_SUMMARY, RANGES_GENERATED } from "@/lib/iprules";
import { number } from "@/lib/format";
import { ECHO_SECONDS } from "@/lib/stats";

// Plain-language list of every rule that marks a request as a bot, with the
// reason label each rule writes, so flagged traffic can be traced to a rule.

const HEADER_RULES: [string, string][] = [
  ["scanner:<name>", "User agent names an email security scanner (Outlook Safe Links, Proofpoint, Mimecast, ...)"],
  ["ua:<token>", "User agent names automation: crawler, headless browser, HTTP library, link preview"],
  ["no-ua", "No user agent at all"],
  ["head", "HEAD request: checks the link without loading the page"],
  ["no-sec-fetch", "No Sec-Fetch-Mode header, which every current browser sends on a navigation"],
  ["no-lang", "No Accept-Language header, which every current browser sends"],
];

function Reason({ children }: { children: string }) {
  return <code className="whitespace-nowrap rounded bg-bar px-1.5 py-0.5 font-mono text-xs text-ink">{children}</code>;
}

export function Rules() {
  const generated = new Date(RANGES_GENERATED).toISOString().slice(0, 10);
  return (
    <section className="rounded-lg border border-line bg-surface">
      <h2 className="border-b border-line px-4 py-3 text-sm font-medium">Bot rules</h2>
      <div className="grid gap-6 p-4 text-sm text-ink-2 md:grid-cols-3">
        <div>
          <h3 className="mb-2 font-medium text-ink">1. Request headers</h3>
          <p className="mb-3 text-xs text-ink-3">Checked by the portfolio when the request arrives.</p>
          <ul className="flex flex-col gap-2">
            {HEADER_RULES.map(([reason, text]) => (
              <li key={reason}>
                <Reason>{reason}</Reason>
                <p className="mt-1">{text}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 font-medium text-ink">2. Data-centre IP</h3>
          <p className="mb-3 text-xs text-ink-3">
            The IP belongs to a cloud or hosting network, where people do not browse from. Ranges from RIPEstat,
            refreshed on every deploy (current: {generated}). Labelled <Reason>{"ip:<network>"}</Reason>.
          </p>
          <ul className="flex flex-col gap-1">
            {NETWORK_SUMMARY.map((n) => (
              <li key={n.name} className="flex justify-between gap-2">
                <span>
                  {n.label} <span className="font-mono text-xs text-ink-3">ip:{n.name}</span>
                </span>
                <span className="tabular-nums text-ink-3">{number(n.prefixes)} prefixes</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">
            CDNs (Cloudflare, Akamai, Fastly) and Google&apos;s main network are not listed: iCloud Private Relay and
            other privacy proxies send real people through them.
          </p>
        </div>
        <div>
          <h3 className="mb-2 font-medium text-ink">3. Echo visits</h3>
          <p className="mb-3 text-xs text-ink-3">Labelled <Reason>echo</Reason>.</p>
          <p>
            An IP opens a page with no referrer and no originating site less than {ECHO_SECONDS} seconds after a
            different, unflagged IP opened the same page. Link-checking security tools replay a person&apos;s visit
            this way from another machine. The person who clicked first keeps counting.
          </p>
        </div>
      </div>
    </section>
  );
}
