import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizePaperDraft, updatePaperDrafts } from '../utils/paperDrafts.js';

export function usePaperDrafts(userId) {
  const key = userId ? `sb-paper-drafts-v1:${userId}` : null;
  const restored = useMemo(() => {
    if (!key) return {};
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || '{}');
      return Object.values(saved).reduce((plans, draft) => updatePaperDrafts(plans, draft), {});
    } catch { return {}; }
  }, [key]);
  const [edited, setEdited] = useState(null);
  const drafts = edited?.key === key ? edited.drafts : restored;
  useEffect(() => {
    if (!key) return;
    try { sessionStorage.setItem(key, JSON.stringify(drafts)); } catch { /* Drafts remain usable in memory. */ }
  }, [key, drafts]);
  const setPaperDraft = useCallback(draft => {
    if (!key || !normalizePaperDraft(draft)) return;
    setEdited(previous => {
      const current = previous?.key === key ? previous.drafts : restored;
      return { key, drafts: updatePaperDrafts(current, draft) };
    });
  }, [key, restored]);
  return { drafts, setPaperDraft };
}
