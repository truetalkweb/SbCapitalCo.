const keyFor = userId => `sb-paper-pending-v1:${userId}`;
function intent(request) {
  const command = { ...request };
  delete command.id;
  // Cost preferences must not turn an unchanged, unconfirmed order into a
  // second execution. Its stored command keeps the original cost snapshot.
  delete command.paperCosts;
  if (command.draft) {
    const draft = { ...command.draft };
    delete draft.id;
    command.draft = draft;
  }
  return JSON.stringify(command);
}
export function preparePaperCommand(request, userId, storage = sessionStorage) {
  const key = keyFor(userId);
  const pending = JSON.parse(storage.getItem(key) || '[]');
  if (!Array.isArray(pending)) throw new Error('Paper request recovery storage requires repair.');
  const fingerprint = intent(request);
  const existing = pending.find(row => row.fingerprint === fingerprint);
  if (existing) return existing.command;
  if (pending.length >= 100) throw new Error('Too many unconfirmed paper requests. Check Orders before continuing.');
  const command = { ...request, id: request.id || crypto.randomUUID() };
  pending.push({ fingerprint, command });
  storage.setItem(key, JSON.stringify(pending));
  return command;
}
export function acknowledgePaperCommand(command, userId, storage = sessionStorage) {
  const key = keyFor(userId);
  const pending = JSON.parse(storage.getItem(key) || '[]').filter(row => row.command.id !== command.id);
  if (pending.length) storage.setItem(key, JSON.stringify(pending));
  else storage.removeItem(key);
}
