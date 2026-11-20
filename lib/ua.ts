// Coarse browser / OS / device classification from a user agent string.
// Ordered checks: the first matching rule wins, so more specific tokens
// (Edg, OPR, CriOS) come before the generic ones they also contain.

export interface Agent {
  browser: string;
  os: string;
  device: string;
}

const BROWSERS: [RegExp, string][] = [
  [/HeadlessChrome/, "Headless Chrome"],
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/FxiOS|Firefox\//, "Firefox"],
  [/CriOS|Chrome\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

function pick(ua: string, rules: [RegExp, string][]): string {
  return rules.find(([re]) => re.test(ua))?.[1] ?? "Other";
}

export function parseAgent(ua: string | null): Agent {
  if (!ua) return { browser: "Unknown", os: "Unknown", device: "Unknown" };
  const device = /iPad|Tablet/.test(ua)
    ? "Tablet"
    : /Mobile|iPhone|Android/.test(ua)
      ? "Mobile"
      : "Desktop";
  return { browser: pick(ua, BROWSERS), os: pick(ua, SYSTEMS), device };
}
