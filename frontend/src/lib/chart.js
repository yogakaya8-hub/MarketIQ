// Validated categorical order (light surface, CVD-separated). Assign in this order, never cycled.
export const SERIES = ['#4F5BD5', '#0E9F8A', '#D97706'];
export const SINGLE = '#0E9F8A';
export const AXIS = { stroke: '#9AA1B8', fontSize: 12, tickLine: false, axisLine: false };
export const GRID = { stroke: '#E3E6EF', strokeDasharray: '0', vertical: false };
export const TOOLTIP = {
  contentStyle: { borderRadius: 10, border: '1px solid #E3E6EF', boxShadow: '0 8px 24px -12px rgba(27,36,64,.25)', fontSize: 13 },
  labelStyle: { color: '#1B2440', fontWeight: 600 },
  itemStyle: { color: '#3A4566' },
  cursor: { fill: 'rgba(27,36,64,0.04)' },
};
export const compactINR = (v) => (v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`);
