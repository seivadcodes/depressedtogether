// src/app/test/report/page.tsx
'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import ReportModal from '@/components/modals/ReportModal';

export default function ReportTestPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Mock data — adjust as needed
  const currentUserId = 'user_123'; // Simulate logged-in user
  const targetId = 'call_456';
  const targetType: 'call' | 'comment' | 'post' | 'user' | 'community' = 'call';
  const callDuration = 1250; // seconds
  const participants = [
    { id: 'user_789', name: 'Alex Johnson' },
    { id: 'user_101', name: 'Taylor Kim' },
    { id: 'user_202', name: 'Jordan Smith' },
  ];

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', background: '#020617', minHeight: '100vh', color: 'white' }}>
      <h1>Report Modal Test Page</h1>
      <p>Click the kebab menu below to open the report modal.</p>

      {/* Kebab Menu Button */}
      <div style={{ position: 'relative', display: 'inline-block', marginTop: '1rem' }}>
        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            borderRadius: '0.375rem',
            color: '#cbd5e1',
          }}
          aria-label="More options"
        >
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetId={targetId}
        targetType={targetType}
        currentUserId={currentUserId}
        callDuration={callDuration}
        participants={participants}
      />
    </div>
  );
}