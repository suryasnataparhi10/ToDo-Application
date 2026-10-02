import { useEffect, useRef, useState } from 'react';

const iconDetails = {
  'All payment methods': { mark: <i className="bi bi-wallet2" />, tone: 'other' },
  Cash: { mark: <i className="bi bi-cash-stack" />, tone: 'cash' },
  Navi: { mark: 'N', tone: 'navi' },
  GPay: { mark: 'G', tone: 'gpay' },
  PhonePe: { mark: 'P', tone: 'phonepe' },
  Paytm: { mark: 'pay', tone: 'paytm' },
  YONO: { mark: 'Y', tone: 'yono' },
  ICICI: { mark: 'I', tone: 'icici' },
  Overseas: { mark: <i className="bi bi-globe2" />, tone: 'overseas' },
  'Debit Card': { mark: <i className="bi bi-credit-card-2-front" />, tone: 'card' },
  'Credit Card': { mark: <i className="bi bi-credit-card" />, tone: 'card' },
  'Bank Transfer': { mark: <i className="bi bi-bank" />, tone: 'bank' },
  Other: { mark: <i className="bi bi-three-dots" />, tone: 'other' },
};

function AppMark({ method }) {
  const { mark, tone } = iconDetails[method] || { mark: <i className="bi bi-wallet2" />, tone: 'other' };
  return <span className={`payment-app-icon ${tone}`} aria-hidden="true">{mark}</span>;
}

export const isUpiApp = (method) =>
  ['Navi', 'GPay', 'PhonePe', 'Paytm', 'YONO', 'ICICI', 'Overseas'].includes(method);

export const formatPaymentMethod = (method) =>
  isUpiApp(method) ? `UPI · ${method}` : method || 'Cash';

export function PaymentMethodBadge({ method }) {
  return (
    <span className="payment-method-badge">
      <AppMark method={method || 'Cash'} />
      <span>{formatPaymentMethod(method || 'Cash')}</span>
    </span>
  );
}

export default function PaymentMethodSelect({ value, onChange, options, ariaLabel, id, className = '' }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className={`payment-method-picker ${className}`} ref={root}>
      <button
        id={id}
        type="button"
        className="form-select payment-method-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="payment-method-current">
          <AppMark method={value} />
          <span>{formatPaymentMethod(value)}</span>
        </span>
      </button>
      {open && (
        <div className="payment-method-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((method) => (
            <button
              key={method}
              type="button"
              role="option"
              aria-selected={value === method}
              className={`payment-method-option${value === method ? ' selected' : ''}`}
              onClick={() => {
                onChange(method);
                setOpen(false);
              }}
            >
              <AppMark method={method} />
              <span>{formatPaymentMethod(method)}</span>
              {value === method && <i className="bi bi-check2 ms-auto" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
