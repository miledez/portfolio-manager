export default function Stat({
  label,
  value,
  sub,
  big = false,
}: {
  label: string;
  value: string;
  sub?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface p-4">
      <p className="mb-1 text-xs text-muted">{label}</p>
      <p className={`${big ? "text-2xl" : "text-xl"} font-semibold tracking-tight`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
