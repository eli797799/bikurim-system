import { useState } from 'react';

export const UNIT_OPTIONS = ["יח'", 'ק"ג', 'גרם', 'ליטר', 'מארז', 'קרטון', 'שק'];
const OTHER = '__other__';

export default function UnitSelector({ value, onChange, placeholder }) {
  const isCustom = value && !UNIT_OPTIONS.includes(value);
  const [showCustomInput, setShowCustomInput] = useState(isCustom);
  const customVal = isCustom ? value : '';

  const handleSelect = (e) => {
    const v = e.target.value;
    if (v === OTHER) {
      setShowCustomInput(true);
      onChange('');
    } else if (v === '' && placeholder) {
      setShowCustomInput(false);
      onChange('');
    } else {
      setShowCustomInput(false);
      onChange(v || '');
    }
  };

  const handleCustomInput = (e) => {
    onChange(e.target.value);
  };

  return (
    <div>
      <select
        value={showCustomInput || isCustom ? OTHER : (value || '')}
        onChange={handleSelect}
        style={{ width: '100%', maxWidth: 400, minHeight: 44, padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u}>{u}</option>
        ))}
        <option value={OTHER}>אחר...</option>
      </select>
      {(showCustomInput || isCustom) && (
        <input
          type="text"
          value={customVal}
          onChange={handleCustomInput}
          placeholder="הזן יחידת מידה"
          style={{ marginTop: 4, width: '100%', maxWidth: 400, minHeight: 44, padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
        />
      )}
    </div>
  );
}
