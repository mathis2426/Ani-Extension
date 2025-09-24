export function getWeekDates(date) {
  const monday = new Date(date);
  const day = monday.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(monday.getDate() + diff);

  return [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function getActiveHours(events, weekDates) {
  const activeHoursSet = new Set();
  weekDates.forEach((date) => {
    const dateStr = date.toLocaleDateString("fr-CA");
    events.filter((e) => e.date === dateStr && e.heure)
      .forEach((e) => activeHoursSet.add(parseInt(e.heure.split(":")[0], 10)));
  });
  return Array.from(activeHoursSet).sort((a, b) => a - b);
}
