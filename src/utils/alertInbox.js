export function collectAlertEvents(alerts) {
  const events = [];
  for (const alert of alerts) {
    const history = Array.isArray(alert.history) ? alert.history : [];
    const triggers = history.filter(event => event?.type === 'triggered');
    if (alert.triggeredAt && !triggers.some(event => event.occurredAt === alert.triggeredAt)) {
      triggers.push({ occurredAt: alert.triggeredAt, price: alert.lastTriggerPrice, trigger: alert.trigger, direction: alert.direction });
    }
    for (const event of triggers) {
      const timestamp = Date.parse(event.occurredAt);
      if (!Number.isFinite(timestamp) || !alert.symbol) continue;
      // The rule fires once per transition. The timestamp also matches older
      // records that stored the latest trigger without a history event ID.
      const id = JSON.stringify([alert.id, new Date(timestamp).toISOString()]);
      events.push({ id, timestamp, symbol: alert.symbol, trigger: event.trigger, direction: event.direction, price: event.price });
    }
  }
  return events;
}
