'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AddMemoryModal from '@/components/angels/AddMemoryModal';
import HeartsAndComments from '@/components/angels/HeartsAndComments'; // Updated import path

const griefLabels = {
  parent: 'Loss of a Parent',
  child: 'Loss of a Child',
  spouse: 'Grieving a Partner',
  sibling: 'Loss of a Sibling',
  friend: 'Loss of a Friend',
  pet: 'Pet Loss',
  miscarriage: 'Pregnancy or Infant Loss',
  caregiver: 'Caregiver Grief',
  suicide: 'Suicide Loss',
  other: 'Other Loss',
};

interface Angel {
  id: string;
  profile_id: string;
  name: string;
  relationship?: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  death_date?: string | null;
  sunrise?: string | null;
  sunset?: string | null;
  tribute?: string | null;
  grief_type: keyof typeof griefLabels;
  is_private: boolean;
  allow_comments: boolean;
}

interface AngelMemory {
  id: string;
  photo_url: string;
  caption?: string | null;
}

export default function AngelDetailPage() {
  const params = useParams<{ id: string }>();
  const [angel, setAngel] = useState<Angel | null>(null);
  const [memories, setMemories] = useState<AngelMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemoryModalOpen, setIsAddMemoryModalOpen] = useState(false);

  useEffect(() => {
    const fetchAngelAndMemories = async () => {
      const { id } = params;

      if (!id || typeof id !== 'string') {
        setError('Invalid memorial ID.');
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();

        // Fetch angel
        const { data: angelData, error: angelError } = await supabase
          .from('angels')
          .select('*')
          .eq('id', id)
          .single();

        if (angelError) throw angelError;

        // Fetch related memories
        const { data: memoryData, error: memoryError } = await supabase
          .from('angel_memories')
          .select('id, photo_url, caption')
          .eq('angel_id', id)
          .order('created_at', { ascending: false });

        if (memoryError) {
          console.warn('Failed to load memories:', memoryError);
        }

        setAngel(angelData);
        setMemories(memoryData || []);
      } catch (err: unknown) {
        console.error('Failed to load angel:', err);
        setError('Memorial not found or access denied.');
      } finally {
        setLoading(false);
      }
    };

    fetchAngelAndMemories();
  }, [params.id]);

/**
 * 获取并更新记忆列表的异步函数
 * 该函数会从数据库中查询指定angel的记忆记录
 * 并更新组件的状态
 */
  // 如果angel不存在，则直接返回
  const refetchMemories = async () => {
    if (!angel) return;
  // 创建Supabase客户端实例
    const supabase = createClient();
  // 从数据库查询angel的记忆记录
    const { data } = await supabase
      .from('angel_memories')
      .select('id, photo_url, caption') // 选择需要查询的字段
      .eq('angel_id', angel.id)
      .order('created_at', { ascending: false });
    setMemories(data || []);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        Loading memorial...
      </div>
    );
  }

  if (error || !angel) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#d32f2f' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link
          href={`/profile/${angel.profile_id}/angels`}
          style={{
            color: '#3b82f6',
            textDecoration: 'none',
            fontSize: '0.95rem',
            fontWeight: '600',
          }}
        >
          ← Back to memorials
        </Link>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Memorial Info */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '1.75rem',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
              {angel.photo_url ? (
                <div style={{ width: '130px', height: '130px', borderRadius: '50%', overflow: 'hidden' }}>
                  <Image
                    src={angel.photo_url}
                    alt={angel.name}
                    width={130}
                    height={130}
                    style={{ objectFit: 'cover' }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '130px',
                    height: '130px',
                    borderRadius: '50%',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '3rem',
                    color: '#64748b',
                  }}
                >
                  {angel.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <h1 style={{ margin: '0 0 0.25rem', fontSize: '2rem', color: '#1e293b' }}>
                  {angel.name}
                </h1>
                {angel.relationship && (
                  <p style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', color: '#64748b' }}>
                    {angel.relationship}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: '1rem', color: '#94a3b8' }}>
                  {griefLabels[angel.grief_type]}
                </p>
              </div>
            </div>

            {angel.tribute && (
              <div style={{ marginTop: '1.75rem', padding: '1.25rem', background: '#f9fafb', borderRadius: '10px' }}>
                <blockquote style={{ margin: 0, fontStyle: 'italic', color: '#334155', lineHeight: 1.7, fontSize: '1.05rem' }}>
                  “{angel.tribute}”
                </blockquote>
              </div>
            )}

            {(angel.sunrise || angel.sunset) && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '1rem' }}>
                {angel.sunrise && <>🌅 Sunrise: {angel.sunrise}<br /></>}
                {angel.sunset && <>🌇 Sunset: {angel.sunset}</>}
              </div>
            )}

            {/* Unified Hearts & Comments */}
            {!angel.is_private && (
              <HeartsAndComments
                itemId={angel.id}
                itemType="angel"
                allowComments={angel.allow_comments}
                styleOverrides={{ 
                  marginTop: '1.5rem',
                  padding: '0.5rem',
                  borderRadius: '8px'
                }}
              />
            )}
          </div>
        </div>

        {/* Gallery & Add Button */}
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <button
            onClick={() => setIsAddMemoryModalOpen(true)}
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            ➕ Add Memory
          </button>

          {memories.length > 0 ? (
            <div
              style={{
                background: '#fff',
                borderRadius: '12px',
                padding: '1rem',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.25rem', color: '#1e293b' }}>
                Shared Memories
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {memories.map((memory) => (
                  <div
                    key={memory.id}
                    style={{
                      background: '#f9fafb',
                      borderRadius: '10px',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      maxWidth: '300px',
                    }}
                  >
                    <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                      <Image
                        src={memory.photo_url}
                        alt={`Memory for ${angel.name}`}
                        width={280}
                        height={280}
                        style={{
                          borderRadius: '8px',
                          objectFit: 'cover',
                          width: '100%',
                          aspectRatio: '1',
                        }}
                      />
                      {memory.caption && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: '0',
                            left: '0',
                            right: '0',
                            background: 'rgba(0,0,0,0.6)',
                            color: 'white',
                            fontSize: '0.8rem',
                            padding: '4px 8px',
                            borderBottomLeftRadius: '8px',
                            borderBottomRightRadius: '8px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {memory.caption}
                        </div>
                      )}
                    </div>
                    {/* Memory-specific Hearts & Comments */}
                    <HeartsAndComments
                      itemId={memory.id}
                      itemType="memory"
                      styleOverrides={{ 
                        marginTop: '0.5rem',
                        marginLeft: '-0.75rem',
                        marginRight: '-0.75rem',
                        marginBottom: '-0.75rem',
                        borderBottomLeftRadius: '8px',
                        borderBottomRightRadius: '8px'
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
                color: '#94a3b8',
              }}
            >
              No shared memories yet.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isAddMemoryModalOpen && angel && (
        <AddMemoryModal
          angelId={angel.id}
          angelName={angel.name}
          onClose={() => setIsAddMemoryModalOpen(false)}
          onMemoryAdded={refetchMemories}
        />
      )}
    </div>
  );
}