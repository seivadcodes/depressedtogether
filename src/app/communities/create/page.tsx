// src/app/communities/create/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Button from '@/components/ui/button';
import { Users, ArrowLeft, Image, X, Brain, Heart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const DEPRESSION_TOPICS = [
  { id: 'general-depression', label: 'General Depression Support', gradient: 'linear-gradient(to bottom right, #93c5fd, #3b82f6)' },
  { id: 'anxiety', label: 'Depression & Anxiety', gradient: 'linear-gradient(to bottom right, #c7d2fe, #6366f1)' },
  { id: 'therapy', label: 'Therapy & Treatment', gradient: 'linear-gradient(to bottom right, #a5f3fc, #06b6d4)' },
  { id: 'medication', label: 'Medication Support', gradient: 'linear-gradient(to bottom right, #d8b4fe, #a855f7)' },
  { id: 'self-care', label: 'Self-Care & Coping', gradient: 'linear-gradient(to bottom right, #86efac, #22c55e)' },
  { id: 'mindfulness', label: 'Mindfulness & Meditation', gradient: 'linear-gradient(to bottom right, #fde68a, #f59e0b)' },
  { id: 'burnout', label: 'Burnout & Exhaustion', gradient: 'linear-gradient(to bottom right, #fca5a5, #ef4444)' },
  { id: 'social-anxiety', label: 'Social Anxiety & Isolation', gradient: 'linear-gradient(to bottom right, #f9a8d4, #ec4899)' },
  { id: 'recovery', label: 'Recovery Journey', gradient: 'linear-gradient(to bottom right, #c4b5fd, #8b5cf6)' },
  { id: 'other', label: 'Other Experience', gradient: 'linear-gradient(to bottom right, #e5e7eb, #9ca3af)' }
];

const baseStyles = {
  minHScreen: { minHeight: '100vh' },
  flexCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
  textCenter: { textAlign: 'center' as const },
  mxAuto: { margin: '0 auto' },
  mb4: { marginBottom: '1rem' },
  mb6: { marginBottom: '1.5rem' },
  mt8: { marginTop: '2rem' },
  pt20: { paddingTop: '5rem' },
  pt6: { paddingTop: '1.5rem' },
  p4: { padding: '1rem' },
  p6: { padding: '1.5rem' },
  maxW2xl: { maxWidth: '42rem' },
  roundedXl: { borderRadius: '1rem' },
  border: { border: '1px solid' },
  shadowSm: { boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)' },
  spaceY6: { display: 'flex', flexDirection: 'column' as const, gap: '1.5rem' },
  spaceY2: { display: 'flex', flexDirection: 'column' as const, gap: '0.5rem' },
  spaceY3: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  block: { display: 'block' },
  fontMedium: { fontWeight: 500 as const },
  textSm: { fontSize: '0.875rem', lineHeight: '1.25rem' },
  textXs: { fontSize: '0.75rem', lineHeight: '1rem' },
  cursorPointer: { cursor: 'pointer' },
  transitionColors: { transition: 'color 0.2s' },
  hoverTextBlue800: { ':hover': { color: '#1e40af' } },
  textBlue700: { color: '#1d4ed8' },
  textBlue800: { color: '#1e40af' },
  textGray800: { color: '#1f2937' },
  textGray700: { color: '#374151' },
  textGray600: { color: '#4b5563' },
  textGray500: { color: '#6b7280' },
  textRed500: { color: '#ef4444' },
  bgWhite: { backgroundColor: '#fff' },
  bgBlue50: { backgroundColor: '#eff6ff' },
  bgBlue100: { backgroundColor: '#dbeafe' },
  bgRed50: { backgroundColor: '#fef2f2' },
  bgBlue500: { backgroundColor: '#3b82f6' },
  bgBlue600: { backgroundColor: '#2563eb' },
  borderGray200: { borderColor: '#e5e7eb' },
  borderGray300: { borderColor: '#d1d5db' },
  borderBlue400: { borderColor: '#60a5fa' },
  borderBlue500: { borderColor: '#3b82f6' },
  focusRingBlue500: { outline: '2px solid #3b82f6', outlineOffset: '2px' },
  roundedLg: { borderRadius: '0.75rem' },
  roundedFull: { borderRadius: '9999px' },
  h4: { height: '1rem' },
  w4: { width: '1rem' },
  h5: { height: '1.25rem' },
  w5: { width: '1.25rem' },
  h7: { height: '1.75rem' },
  w7: { width: '1.75rem' },
  h8: { height: '2rem' },
  w8: { width: '2rem' },
  h14: { height: '3.5rem' },
  w14: { width: '3.5rem' },
  p1_5: { padding: '0.375rem' },
  p3: { padding: '0.75rem' },
  px4: { paddingLeft: '1rem', paddingRight: '1rem' },
  py2: { paddingTop: '0.5rem', paddingBottom: '0.5rem' },
  py3: { paddingTop: '0.75rem', paddingBottom: '0.75rem' },
  minH100: { minHeight: '100px' },
  h48: { height: '12rem' },
  wFull: { width: '100%' },
  objectCover: { objectFit: 'cover' as const },
  absolute: { position: 'absolute' as const },
  inset0: { top: 0, right: 0, bottom: 0, left: 0 },
  opacity0: { opacity: 0 },
  opacity100: { opacity: 1 },
  pointerEventsNone: { pointerEvents: 'none' as const },
  flex: { display: 'flex' },
  itemsCenter: { alignItems: 'center' },
  justifyCenter: { justifyContent: 'center' },
  group: { position: 'relative' },
  animateSpin: { animation: 'spin 1s linear infinite' },
  '@keyframes spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' }
  }
};

export default function CreateCommunityPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState(DEPRESSION_TOPICS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { user, sessionChecked } = useAuth();
  const [otherExperienceDescription, setOtherExperienceDescription] = useState('');

  useEffect(() => {
    if (sessionChecked && !user) {
      const currentPath = window.location.pathname;
      router.push(`/auth?redirectTo=${encodeURIComponent(currentPath)}`);
    }
  }, [user, sessionChecked, router]);

  if (!sessionChecked) {
    return (
      <div style={{ 
        ...baseStyles.minHScreen, 
        ...baseStyles.flexCenter,
        background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
      }}>
        <div style={baseStyles.textCenter}>
          <div
            style={{
              height: '2rem',
              width: '2rem',
              animation: 'spin 1s linear infinite',
              borderRadius: '9999px',
              border: '4px solid #3b82f6',
              borderTopColor: 'transparent',
              margin: '0 auto 1rem'
            }}
          ></div>
          <p style={{ color: '#4b5563' }}>Verifying your session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !description.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (name.length < 3) {
      setError('Community name must be at least 3 characters long');
      return;
    }

    if (description.length < 10) {
      setError('Please provide a more detailed description');
      return;
    }

    if (!user) {
      setError('Session expired. Please log in again to create a community.');
      router.push('/auth?redirectTo=/communities/create');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setUploadError(null);

    try {
      const communityId = generateSlug(name);

      const { data: existingCommunity, error: checkError }  = await supabase
        .from('communities')
        .select('id')
        .eq('id', communityId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking for existing community:', checkError);
        setError('Unable to verify community availability. Please try again.');
        return;
      }

      if (existingCommunity) {
        setError('A community with this name already exists. Please choose a different name.');
        setIsSubmitting(false);
        return;
      }

      const { error: communityError } = await supabase
        .from('communities')
        .insert({
          id: communityId,
          name: name.trim(),
          description: description.trim(),
          topic: topic,
          other_experience_description: topic === 'other' ? otherExperienceDescription.trim() || null : null,
          member_count: 0,
          online_count: 0,
          created_at: new Date().toISOString()
        });

      if (communityError) throw communityError;

      const { error: memberError } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          role: 'admin'
        });

      if (memberError) throw memberError;

      let savedBannerPath: string | null = null;

      if (fileToUpload) {
        try {
          const fileExt = fileToUpload.name.split('.').pop();
          const fileName = `${communityId}/banner.${fileExt || 'jpg'}`;

          const { error: uploadError } = await supabase.storage
            .from('communities')
            .upload(fileName, fileToUpload, { upsert: true });

          if (uploadError) throw uploadError;

          savedBannerPath = `communities/${fileName}`;
        } catch (uploadErr: unknown) {
          console.error('Banner upload failed:', uploadErr);
          setUploadError('Banner upload failed, but your community was created. You can add a banner later.');
        }
      }

      const { error: updateError } = await supabase
        .from('communities')
        .update({ cover_photo_url: savedBannerPath })
        .eq('id', communityId);

      if (updateError) {
        console.warn('Failed to save banner path:', updateError);
      }

      router.push(`/communities/${communityId}`);
    } catch (err: unknown) {
      console.error('Community creation error:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to create community. Please try again.');
      } else {
        setError('Failed to create community. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, GIF, etc.)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setFileToUpload(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewImage(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to load image preview. Please try a different image.');
    };
    reader.readAsDataURL(file);
  };

  const removeBanner = () => {
    setPreviewImage(null);
    setFileToUpload(null);
    setError(null);
  };

  return (
    <div
      style={{
        ...baseStyles.minHScreen,
        background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
        padding: '1rem',
        paddingTop: '2rem'
      }}
    >
      <div style={{ ...baseStyles.maxW2xl, ...baseStyles.mxAuto }}>
        <button
          onClick={() => router.back()}
          style={{
            ...baseStyles.flex,
            ...baseStyles.itemsCenter,
            color: '#3b82f6',
            ...baseStyles.transitionColors,
            marginBottom: '1.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#1e40af'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
        >
          <ArrowLeft style={{ height: '1rem', width: '1rem', marginRight: '0.25rem' }} />
          <span>Back to Communities</span>
        </button>

        <div style={baseStyles.textCenter}>
          <div
            style={{
              ...baseStyles.w14,
              ...baseStyles.h14,
              ...baseStyles.roundedFull,
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              border: '2px solid #3b82f6',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)',
            }}
          >
            <Brain style={{ height: '1.75rem', width: '1.75rem', color: '#1e40af' }} />
          </div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 800, 
            color: '#1e40af', 
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Create Your Community
          </h1>
          <p style={{ color: '#4b5563', fontSize: '1.125rem', lineHeight: '1.6' }}>
            Start a safe space where others who share your depression journey can find connection and support.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            ...baseStyles.roundedXl,
            border: '1px solid rgba(59, 130, 246, 0.2)',
            ...baseStyles.p6,
            ...baseStyles.shadowSm,
            marginTop: '1.5rem',
          }}
        >
          <form onSubmit={handleSubmit} style={baseStyles.spaceY6}>
            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, color: '#1e40af' }}>
                Community Banner (optional)
              </label>
              <div style={{ position: 'relative' }}>
                {previewImage ? (
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        ...baseStyles.border,
                        borderColor: 'rgba(59, 130, 246, 0.2)',
                        ...baseStyles.roundedLg,
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                      onClick={() => document.getElementById('banner-upload')?.click()}
                    >
                      <div style={{ ...baseStyles.h48, ...baseStyles.wFull, backgroundColor: '#f8fafc' }}>
                        <img
                          src={previewImage}
                          alt="Community banner preview"
                          style={{ ...baseStyles.wFull, ...baseStyles.h48, ...baseStyles.objectCover }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            setPreviewImage(null);
                          }}
                        />
                      </div>
                    </div>
                    <div
                      style={{
                        ...baseStyles.absolute,
                        ...baseStyles.inset0,
                        background: 'rgba(0,0,0,0)',
                        transition: 'background 0.3s',
                        borderRadius: '0.75rem'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                    ></div>
                    <div
                      style={{
                        ...baseStyles.absolute,
                        ...baseStyles.inset0,
                        ...baseStyles.flex,
                        ...baseStyles.itemsCenter,
                        ...baseStyles.justifyCenter,
                        opacity: 0,
                        transition: 'opacity 0.3s',
                        pointerEvents: 'none'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
                    >
                      <div
                        style={{
                          color: '#fff',
                          background: 'rgba(0,0,0,0.5)',
                          padding: '0.5rem 1rem',
                          borderRadius: '9999px',
                          display: 'flex',
                          alignItems: 'center',
                          fontSize: '0.875rem'
                        }}
                      >
                        <Image style={{ height: '1rem', width: '1rem', marginRight: '0.5rem' }} />
                        <span>Change banner</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBanner();
                      }}
                      style={{
                        ...baseStyles.absolute,
                        top: '-0.5rem',
                        right: '-0.5rem',
                        background: '#3b82f6',
                        color: '#fff',
                        ...baseStyles.roundedFull,
                        ...baseStyles.p1_5,
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        transition: 'background-color 0.2s',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
                      title="Remove banner"
                    >
                      <X style={{ height: '1rem', width: '1rem' }} />
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      border: '2px dashed rgba(59, 130, 246, 0.3)',
                      ...baseStyles.roundedLg,
                      padding: '1.5rem',
                      ...baseStyles.textCenter,
                      ...baseStyles.cursorPointer,
                      backgroundColor: 'rgba(255, 255, 255, 0.5)',
                      transition: 'all 0.2s ease-in-out',
                    }}
                    onClick={() => document.getElementById('banner-upload')?.click()}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    <div
                      style={{
                        ...baseStyles.mxAuto,
                        width: '4rem',
                        height: '4rem',
                        ...baseStyles.roundedFull,
                        backgroundColor: '#dbeafe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.75rem',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                      }}
                    >
                      <Image style={{ height: '2rem', width: '2rem', color: '#3b82f6' }} />
                    </div>
                    <p style={{ color: '#1e40af', ...baseStyles.fontMedium, marginBottom: '0.25rem' }}>
                      Upload a banner image
                    </p>
                    <p style={{ ...baseStyles.textSm, color: '#6b7280' }}>
                      Recommended: 1200x300px (16:9 ratio), max 5MB
                    </p>
                  </div>
                )}
              </div>
              <input
                type="file"
                id="banner-upload"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
            </div>

            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, color: '#1e40af' }}>
                Community Name <span style={baseStyles.textRed500}>*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Depression Support Group"
                style={{
                  ...baseStyles.wFull,
                  ...baseStyles.px4,
                  ...baseStyles.py2,
                  border: '1px solid #d1d5db',
                  ...baseStyles.roundedLg,
                  outline: 'none',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
                  transition: 'all 150ms ease-in-out',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
                maxLength={60}
              />
            </div>

            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, color: '#1e40af' }}>
                Description <span style={baseStyles.textRed500}>*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your community in 1-2 sentences. What depression experience does it center around?"
                style={{
                  ...baseStyles.wFull,
                  ...baseStyles.px4,
                  ...baseStyles.py2,
                  border: '1px solid #d1d5db',
                  ...baseStyles.roundedLg,
                  outline: 'none',
                  minHeight: '100px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  transition: 'all 150ms ease-in-out',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#3b82f6';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
                maxLength={250}
              />
              <p style={{ ...baseStyles.textXs, color: '#6b7280' }}>
                {description.length}/250 characters
              </p>
            </div>

            <div style={baseStyles.spaceY2}>
              <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, color: '#1e40af' }}>
                Primary Topic <span style={baseStyles.textRed500}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                {DEPRESSION_TOPICS.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTopic(type.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      ...baseStyles.p3,
                      ...baseStyles.roundedLg,
                      border: '1px solid',
                      textAlign: 'left' as const,
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      ...(topic === type.id
                        ? {
                            borderColor: '#3b82f6',
                            background: type.gradient,
                            color: '#fff',
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                          }
                        : {
                            borderColor: '#d1d5db',
                            backgroundColor: '#fff',
                            color: '#1f2937',
                          })
                    }}
                    onMouseOver={(e) => {
                      if (topic !== type.id) {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (topic !== type.id) {
                        e.currentTarget.style.borderColor = '#d1d5db';
                        e.currentTarget.style.backgroundColor = '#fff';
                      }
                    }}
                  >
                    <div
                      style={{
                        width: '0.75rem',
                        height: '0.75rem',
                        borderRadius: '9999px',
                        background: type.gradient,
                        marginRight: '0.75rem'
                      }}
                    ></div>
                    <span style={baseStyles.fontMedium}>{type.label}</span>
                  </button>
                ))}
              </div>
              <p style={baseStyles.textXs}>
                This helps match your community with others experiencing similar depression-related challenges
              </p>
            </div>

            {topic === 'other' && (
              <div style={baseStyles.spaceY2}>
                <label style={{ ...baseStyles.block, ...baseStyles.textSm, ...baseStyles.fontMedium, color: '#1e40af' }}>
                  Please describe this experience
                </label>
                <input
                  type="text"
                  value={otherExperienceDescription}
                  onChange={(e) => setOtherExperienceDescription(e.target.value)}
                  placeholder="e.g., Depression related to chronic illness, workplace stress, etc."
                  style={{
                    ...baseStyles.wFull,
                    ...baseStyles.px4,
                    ...baseStyles.py2,
                    border: '1px solid #d1d5db',
                    ...baseStyles.roundedLg,
                    outline: 'none',
                    backgroundColor: 'white',
                    color: '#374151',
                    fontSize: '0.875rem',
                    transition: 'all 150ms ease-in-out',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#d1d5db';
                    e.target.style.boxShadow = 'none';
                  }}
                  maxLength={100}
                />
                <p style={{ ...baseStyles.textXs, color: '#6b7280' }}>
                  {otherExperienceDescription.length}/100 characters
                </p>
              </div>
            )}

            {error && (
              <div style={{ 
                ...baseStyles.p3, 
                backgroundColor: '#fee2e2', 
                color: '#b91c1c', 
                ...baseStyles.roundedLg, 
                ...baseStyles.textSm,
                border: '1px solid #fecaca',
              }}>
                {error}
              </div>
            )}

            {uploadError && (
              <div style={{ 
                ...baseStyles.p3, 
                backgroundColor: '#fffbeb', 
                color: '#92400e', 
                ...baseStyles.roundedLg, 
                ...baseStyles.textSm,
                border: '1px solid #fef3c7',
              }}>
                {uploadError}
              </div>
            )}

            <div style={{ 
              ...baseStyles.pt6, 
              borderTop: '1px solid rgba(229, 231, 235, 0.5)',
              paddingTop: '1.5rem'
            }}>
              <Button
                type="submit"
                disabled={isSubmitting || !name.trim() || !description.trim()}
                style={{
                  ...baseStyles.wFull,
                  ...baseStyles.py3,
                  ...baseStyles.fontMedium,
                  background: isSubmitting || !name.trim() || !description.trim() 
                    ? 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)' 
                    : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#fff',
                  cursor: isSubmitting || !name.trim() || !description.trim() ? 'not-allowed' : 'pointer',
                  border: 'none',
                  ...baseStyles.roundedLg,
                  fontSize: '1rem',
                  transition: 'all 300ms ease-in-out',
                  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting && name.trim() && description.trim()) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting && name.trim() && description.trim()) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)';
                  }
                }}
              >
                {isSubmitting ? (
                  <span style={{ ...baseStyles.flex, ...baseStyles.itemsCenter, ...baseStyles.justifyCenter }}>
                    <span
                      style={{
                        height: '1.25rem',
                        width: '1.25rem',
                        animation: 'spin 1s linear infinite',
                        borderRadius: '9999px',
                        border: '2px solid #fff',
                        borderTopColor: 'transparent',
                        marginRight: '0.5rem'
                      }}
                    ></span>
                    Creating Community...
                  </span>
                ) : (
                  'Create Community'
                )}
              </Button>
              <p style={{ 
                ...baseStyles.textCenter, 
                ...baseStyles.textXs, 
                color: '#6b7280', 
                marginTop: '0.75rem',
                padding: '0 1rem'
              }}>
                By creating this community, you agree to moderate it with care and compassion. You can add co-moderators later.
              </p>
            </div>
          </form>
        </div>

        <div
          style={{
            ...baseStyles.mt8,
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            ...baseStyles.roundedXl,
            border: '1px solid rgba(59, 130, 246, 0.2)',
            ...baseStyles.p6,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          }}
        >
          <h3 style={{ 
            ...baseStyles.fontMedium, 
            color: '#1e40af', 
            marginBottom: '0.75rem', 
            display: 'flex', 
            alignItems: 'center',
            fontSize: '1.125rem',
          }}>
            <span
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#3b82f6',
                display: 'inline-block',
                marginRight: '0.75rem'
              }}
            ></span>
            Community Guidelines
          </h3>
          <ul style={{ 
            ...baseStyles.spaceY2, 
            ...baseStyles.textSm, 
            color: '#4b5563', 
            paddingLeft: '1.5rem',
            lineHeight: '1.6'
          }}>
            <li>• Your community should have a clear focus on a specific depression experience</li>
            <li>• You are responsible for creating a safe, inclusive space for all members</li>
            <li>• Support each other with empathy and understanding</li>
            <li>• Communities that become inactive or harmful may be archived</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}