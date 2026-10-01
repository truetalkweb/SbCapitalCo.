import { useEffect, useState } from 'react';

// Refresh at minute boundaries even when quotes stop arriving. Resume promptly
// after a suspended/background tab without polling the whole app every second.
export function useMarketClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer;
    const update = () => {
      clearTimeout(timer);
      const time = Date.now(); setNow(new Date(time));
      timer = setTimeout(update, 60000 - time % 60000);
    };
    timer = setTimeout(update, 60000 - Date.now() % 60000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, []);
  return now;
}
