import { RECORDING_LIMITS } from './recordingImport.js';

export function importRecordingFile(file, { signal } = {}) {
  if (!file || file.size <= 0 || file.size > RECORDING_LIMITS.bytes) return Promise.reject(new Error('Choose a non-empty JSON recording up to 8 MiB.'));
  if (!/\.json$/i.test(file.name)) return Promise.reject(new Error('Choose a .json recording in the SBCapitalCo format. Vendor exports need conversion first.'));
  if (signal?.aborted) return Promise.reject(new DOMException('Import cancelled.', 'AbortError'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./recordingImport.worker.js', import.meta.url), { type: 'module' });
    let timer, finished = false;
    const finish = (error, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer); signal?.removeEventListener('abort', cancel); worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    const cancel = () => finish(new DOMException('Import cancelled.', 'AbortError'));
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => finish(new Error('Recording validation timed out. Import a smaller segment.')), 15000);
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : null, data.snapshot);
    worker.onerror = () => finish(new Error('Recording validation could not start. Please retry in a supported browser.'));
    try { worker.postMessage({ file }); } catch { finish(new Error('Recording could not be sent for validation.')); }
  });
}
