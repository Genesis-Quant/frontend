export function formatDateTime(value: string | null | undefined, now = new Date()) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  const sameDay = sameYear && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return time;
  const monthDay = `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return sameYear ? `${monthDay} ${time}` : `${String(date.getFullYear()).slice(-2)}-${monthDay} ${time}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
