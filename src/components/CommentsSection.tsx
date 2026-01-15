'use client';

import CommentsSection from '@/components/CommentsSection';

export default function CommentsSectionTestPage() {
  const mockPostId = 'post_12345';

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#1e293b' }}>
        💬 Inline Comments Section Test
      </h1>

      {/* Simulated Post */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.25rem',
          background: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#cbd5e1',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#64748b',
              fontWeight: 'bold',
            }}
          >
            AR
          </div>
          <div>
            <div style={{ fontWeight: '600', color: '#1e293b' }}>Alex Rivera</div>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>2 hours ago</div>
          </div>
        </div>

        <div
          style={{
            width: '100%',
            height: '200px',
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#94a3b8',
            marginBottom: '1rem',
          }}
        >
          🖼️ Memory Photo
        </div>

        <p style={{ color: '#1e293b', lineHeight: 1.6 }}>
          Today I remembered how my dog used to wait by the door every time I came home. Those little moments stay with you forever.
        </p>

        {/* 👇 INLINE COMMENTS — no modal! */}
        <CommentsSection targetId={mockPostId} targetType="post" />
      </div>
    </div>
  );
}