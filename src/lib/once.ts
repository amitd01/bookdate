/** One-time hints (coach marks, banners) remembered on the device. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** Returns [done, finish]. Starts as done so a hint never flashes before storage loads. */
export function useOnce(key: string) {
  const [done, setDone] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(key).then((v) => setDone(v === '1')).catch(() => undefined);
  }, [key]);
  const finish = useCallback(() => {
    setDone(true);
    AsyncStorage.setItem(key, '1').catch(() => undefined);
  }, [key]);
  return [done, finish] as const;
}
