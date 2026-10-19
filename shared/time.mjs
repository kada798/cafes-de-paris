export function parisLocalInput(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function parseParisLocal(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const desired = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(desired)) return null;
  let guess = desired;
  for (let i = 0; i < 4; i++) {
    const displayed = parisLocalInput(new Date(guess));
    if (displayed === value) return new Date(guess).toISOString();
    guess += desired - Date.parse(`${displayed}:00Z`);
  }
  return null;
}
