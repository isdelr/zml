// hooks/useBrowserNotifier.ts
import { useState, useEffect, useCallback } from 'react';

const DONT_ASK_AGAIN_KEY = 'notification-permission-dont-ask';
const PROMPT_DISMISSED_KEY = 'notification-permission-prompt-dismissed';
const PROMPT_DISMISSED_TIMEOUT = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useBrowserNotifier() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isPromptVisible, setIsPromptVisible] = useState(false);

  // Check initial permission status on mount
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Determine if the prompt should be shown
  useEffect(() => {
    if (permission === 'default') {
      const dontAsk = localStorage.getItem(DONT_ASK_AGAIN_KEY);
      if (dontAsk === 'true') {
        setIsPromptVisible(false);
        return;
      }

      const dismissedTimestamp = localStorage.getItem(PROMPT_DISMISSED_KEY);
      if (dismissedTimestamp) {
        if (Date.now() - parseInt(dismissedTimestamp, 10) < PROMPT_DISMISSED_TIMEOUT) {
          setIsPromptVisible(false);
          return;
        }
      }
      
      // If not permanently denied and not recently dismissed, show the prompt.
      setIsPromptVisible(true);
    } else {
      setIsPromptVisible(false);
    }
  }, [permission]);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.error('This browser does not support desktop notification');
      return;
    }

    const currentPermission = await Notification.requestPermission();
    setPermission(currentPermission);
    setIsPromptVisible(false);

    if (currentPermission !== 'granted') {
        // If user denies, we can assume they don't want to be asked again for a while.
        localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
    } else {
        // Clear dismissal keys if permission is granted
        localStorage.removeItem(DONT_ASK_AGAIN_KEY);
        localStorage.removeItem(PROMPT_DISMISSED_KEY);
    }
  }, []);

  const showNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (permission === 'granted') {
      new Notification(title, {
          icon: '/favicon.svg', // Default icon
          ...options,
      });
    }
  }, [permission]);

  const dismissPrompt = useCallback((permanent = false) => {
      if (permanent) {
          localStorage.setItem(DONT_ASK_AGAIN_KEY, 'true');
      } else {
          localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
      }
      setIsPromptVisible(false);
  }, []);

  return { isPromptVisible, requestPermission, dismissPrompt, showNotification, permission };
}