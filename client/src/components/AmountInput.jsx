import { useRef } from 'react';

function formatAmount(value) {
  const clean = String(value ?? '').replace(/,/g, '');
  const [integer, ...fraction] = clean.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction.length ? `${grouped}.${fraction.join('').slice(0, 2)}` : grouped;
}

export default function AmountInput({ value, onChange, ...props }) {
  const input = useRef(null);
  const handleChange = (event) => {
    const shown = event.target.value;
    const caret = event.target.selectionStart ?? shown.length;
    const rawBeforeCaret = shown
      .slice(0, caret)
      .replace(/,/g, '')
      .replace(/[^\d.]/g, '');
    let raw = shown.replace(/,/g, '').replace(/[^\d.]/g, '');
    const decimalAt = raw.indexOf('.');
    if (decimalAt !== -1)
      raw = `${raw.slice(0, decimalAt + 1)}${raw
        .slice(decimalAt + 1)
        .replace(/\./g, '')
        .slice(0, 2)}`;
    onChange({ target: { value: raw } });
    requestAnimationFrame(() => {
      if (!input.current) return;
      const formatted = formatAmount(raw);
      let position = 0;
      let digits = 0;
      while (position < formatted.length && digits < rawBeforeCaret.length) {
        if (formatted[position] !== ',') digits++;
        position++;
      }
      input.current.setSelectionRange(position, position);
    });
  };
  return (
    <input
      {...props}
      ref={input}
      type="text"
      inputMode="decimal"
      value={formatAmount(value)}
      onChange={handleChange}
      autoComplete="off"
    />
  );
}
