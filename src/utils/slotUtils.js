import { DateTime } from "luxon";

/**
 * Returns available time slots for given venue/court on a specific date and within a time range.
 * @param {Object} venue - Venue object (not used currently but can be extended)
 * @param {Object} court - Court object with defaultAvailability array
 * @param {string} dateStr - Date string in 'YYYY-MM-DD'
 * @param {string} startTimeStr - Start time filter 'HH:mm'
 * @param {string} endTimeStr - End time filter 'HH:mm'
 * @returns {Array<{ start: string, end: string, label: string }>} list of slots
 */
export function getAvailableSlots(
  venue,
  court,
  dateStr,
  startTimeStr,
  endTimeStr
) {
  if (!court.defaultAvailability) return [];
  const dt = DateTime.fromISO(dateStr);
  const dayOfWeek = dt.weekday % 7; // Luxon: 1=Monday,..7=Sunday; convert to 0=Sunday

  // Find availability entry for that day
  const entry = court.defaultAvailability.find(
    (e) => e.dayOfWeek === dayOfWeek
  );
  if (!entry) return [];

  // Parse filter times (default to full day if not provided)
  const filterStart = startTimeStr
    ? DateTime.fromISO(`${dateStr}T${startTimeStr}`)
    : DateTime.fromISO(`${dateStr}T00:00`);
  const filterEnd = endTimeStr
    ? DateTime.fromISO(`${dateStr}T${endTimeStr}`)
    : DateTime.fromISO(`${dateStr}T23:59`);

  // Split availability blocks into 1-hour slots
  const blocks = [];
  for (const slot of entry.timeSlots) {
    const blockStart = DateTime.fromISO(`${dateStr}T${slot.start}`);
    const blockEnd = DateTime.fromISO(`${dateStr}T${slot.end}`);
    // Apply filter intersection
    const startDt = blockStart < filterStart ? filterStart : blockStart;
    const endLimit = blockEnd > filterEnd ? filterEnd : blockEnd;
    // Generate hourly slots
    let current = startDt;
    while (current.plus({ hours: 1 }) <= endLimit) {
      blocks.push({ startDt: current, endDt: current.plus({ hours: 1 }) });
      current = current.plus({ hours: 1 });
    }
  }
  // Map into labelled choices
  return blocks.map(({ startDt, endDt }) => {
    const start = startDt.toFormat("HH:mm");
    const end = endDt.toFormat("HH:mm");
    // Determine day type
    const weekday = DateTime.fromISO(dateStr).weekday % 7;
    const dayType = [0, 6].includes(weekday) ? "weekend" : "weekday";
    // Find pricing rule by slot start time
    const rule = (court.pricing || []).find(
      (p) =>
        p.dayType === dayType &&
        p.isActive &&
        startDt >= DateTime.fromISO(`${dateStr}T${p.timeSlot.start}`) &&
        startDt < DateTime.fromISO(`${dateStr}T${p.timeSlot.end}`)
    );
    const cost = rule ? rule.pricePerHour : 0;
    const priceLabel = cost.toLocaleString("vi-VN") + " đ";
    return {
      value: `${start}-${end}`,
      label: `${start} - ${end} (${priceLabel})`,
    };
  });
}
