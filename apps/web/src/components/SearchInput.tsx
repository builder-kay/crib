type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchInput({ value, onChange, placeholder = "Search assets" }: SearchInputProps) {
  return (
    <label className="flex w-full items-center gap-2 rounded-full border border-sand-200 bg-sand-50 px-4 py-2 transition focus-within:border-cobalt-400 focus-within:bg-white">
      <svg className="h-4 w-4 text-sand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-sand-400"
      />
    </label>
  );
}
