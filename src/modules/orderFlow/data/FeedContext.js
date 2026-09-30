import { createContext, useContext } from 'react';
export const FeedContext = createContext({ simulated: true, status: 'connected', source: 'Simulator', metadata: null, quality: null });
export const useFeedContext = () => useContext(FeedContext);
