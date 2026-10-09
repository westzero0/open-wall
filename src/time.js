export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

export const toMin = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
const p2 = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
// 밤 (자동 화면 turns dark): 23:00 up to, not including, 08:00 by the phone's clock.
export const isNight = (d) => d.getHours() >= 23 || d.getHours() < 8;
export const hhmm =(d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
