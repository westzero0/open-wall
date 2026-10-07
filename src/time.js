export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const toMin = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
const p2 = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hhmm = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
