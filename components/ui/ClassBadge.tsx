import { CLASS_COLOR, type AssetClass } from "@/lib/constants";

export default function ClassBadge({ assetClass }: { assetClass: string }) {
  const color = CLASS_COLOR[assetClass as AssetClass] ?? "#6B7280";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color, background: `${color}14` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      {assetClass}
    </span>
  );
}
