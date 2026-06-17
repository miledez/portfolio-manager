export default function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={disabled ? "n/a" : placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-hairline px-2.5 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
      />
    </label>
  );
}
