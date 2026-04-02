type Props = {
  value: string;
  onChange: (ym: string) => void;
};

/** `value` is YYYY-MM for input[type=month] */
export function MonthPicker({ value, onChange }: Props) {
  return (
    <label className="month-picker">
      <span>Month</span>
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
