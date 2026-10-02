export const PAY = ['Cash', 'Navi', 'GPay', 'PhonePe', 'Paytm', 'YONO', 'ICICI', 'Overseas', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];
export const inr = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
export const COLORS = [
  '#4f6bff',
  '#ef8a69',
  '#6477a8',
  '#bc6a83',
  '#9877c4',
  '#dda94b',
  '#3f9fc1',
  '#d777a9',
  '#7180a6',
  '#b78956',
];
