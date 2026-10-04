const keyFor = userId => `sb-alert-pending-v1:${userId}`;

export function readPendingAlertCommand(userId, storage = sessionStorage) {
  const raw = storage.getItem(keyFor(userId));
  if (!raw) return null;
  let row;
  try { row = JSON.parse(raw); } catch { throw new Error('Alert recovery storage is invalid. Do not repeat the change until storage is repaired.'); }
  if (row?.version !== 1 || typeof row.intent !== 'string' || !row.command?.id || !['upsert', 'remove', 'pause', 'monitoring'].includes(row.command.kind)) {
    throw new Error('Alert recovery storage is invalid. Do not repeat the change until storage is repaired.');
  }
  return row;
}

function intent(request, create) {
  if (request.kind === 'upsert') {
    const { id, symbol, trigger, direction, active } = request.alert;
    return JSON.stringify(['upsert', create ? 'create' : id, symbol, trigger, direction, active]);
  }
  const copy = { ...request }; delete copy.id;
  return JSON.stringify(copy);
}

// Serialize uncertain mutations: an older edit must not be replayed after a newer one.
export function prepareAlertCommand(request, userId, { create = false } = {}, storage = sessionStorage) {
  const fingerprint = intent(request, create), pending = readPendingAlertCommand(userId, storage);
  if (pending) {
    if (pending.intent !== fingerprint) throw new Error('An alert change is awaiting confirmation. It will retry when the connection recovers; wait before making another change.');
    return pending.command;
  }
  const command = JSON.parse(JSON.stringify({ ...request, id: crypto.randomUUID() }));
  storage.setItem(keyFor(userId), JSON.stringify({ version: 1, intent: fingerprint, command }));
  return command;
}

export function acknowledgeAlertCommand(command, userId, storage = sessionStorage) {
  if (readPendingAlertCommand(userId, storage)?.command.id === command.id) storage.removeItem(keyFor(userId));
}
