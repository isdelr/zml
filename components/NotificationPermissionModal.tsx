 
'use client';

import { useBrowserNotifier } from '@/hooks/useBrowserNotifier';
import { BellRing, X } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

export function NotificationPermissionModal() {
  const { isPromptVisible, requestPermission, dismissPrompt } = useBrowserNotifier();

  if (!isPromptVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-8">
      <Card className="max-w-sm shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <BellRing className="size-6 text-primary" />
              <CardTitle>Get Notified</CardTitle>
            </div>
            <button onClick={() => dismissPrompt(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <CardDescription>
            Enable browser notifications to stay updated on round changes and comments.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-between">
            <Button variant="link" onClick={() => dismissPrompt(true)}>
                Never ask again
            </Button>
            <Button onClick={requestPermission}>
                Turn On Notifications
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}