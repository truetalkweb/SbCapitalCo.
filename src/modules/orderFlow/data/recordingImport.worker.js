import { parseOrderFlowRecording } from './recordingImport.js';
globalThis.onmessage = async ({ data }) => {
  try {
    const snapshot = parseOrderFlowRecording(await data.file.text(), { name: data.file.name });
    globalThis.postMessage({ snapshot });
  } catch (error) { globalThis.postMessage({ error: error.message || 'Recording could not be imported.' }); }
};
