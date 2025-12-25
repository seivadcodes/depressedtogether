// components/VideoRequestNotification.tsx
import { useState } from 'react';
import { Check, X, Video } from 'lucide-react';

export function VideoRequestNotification({
  requesterName,
  onAccept,
  onDecline,
}: {
  requesterName: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [isResponded, setIsResponded] = useState(false);

  if (isResponded) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-lg p-4 border border-amber-200 z-50 animate-in slide-in-from-bottom fade-in">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Video className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-stone-800">
            {requesterName} wants to enable video
          </p>
          <p className="text-xs text-stone-500 mt-1">
            This will turn on cameras for everyone in the call
          </p>
        </div>
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => {
              setIsResponded(true);
              onAccept();
            }}
            className="p-1 text-green-600 hover:bg-green-100 rounded-full"
            title="Accept video request"
          >
            <Check className="h-5 w-5" />
          </button>
          <button
            onClick={() => {
              setIsResponded(true);
              onDecline();
            }}
            className="p-1 text-red-600 hover:bg-red-100 rounded-full"
            title="Decline video request"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}