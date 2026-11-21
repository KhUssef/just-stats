// A country's flag at text size, from flagcdn's public SVG set. The flag is
// decorative: the country name always sits next to it. Unknown countries get
// an empty frame of the same size so rows stay aligned.
export function Flag({ code }: { code: string | null | undefined }) {
  if (!code) {
    return <span aria-hidden className="inline-block h-3.5 w-5 shrink-0 rounded-[3px] border border-dashed border-line" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt=""
      width={20}
      height={14}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-3.5 w-5 shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_var(--border)]"
    />
  );
}
