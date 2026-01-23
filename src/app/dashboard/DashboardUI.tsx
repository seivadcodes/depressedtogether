'use client';
import { useState, useEffect } from 'react';
import {
  Heart,
  MessageCircle,
  Users,
  Edit,
  Send,
  Camera,
  X,
  Settings,
  ToggleLeft,
  User,
  Brain,
  Sparkles,
} from 'lucide-react';
import type {
  Post,
  UserProfile,
  UserPreferences,
  DashboardUIProps
} from './useDashboardLogic';
import Image from 'next/image';
import Link from 'next/link';
import { CommentsSection } from '@/components/CommentsSection';
import { PostCard } from '@/components/PostCard';
import { PostComposer } from '@/components/PostComposer';
// =============== Base Styles ===============
const baseStyles = {
  container: {
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  textCenter: { textAlign: 'center' as const },
  flexCenter: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
  fullScreenCenter: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafaf9',
  },
  buttonBase: {
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'background-color 0.2s, color 0.2s',
  },
  inputBase: {
    padding: '0.625rem',
    border: '1px solid #d6d3d1',
    borderRadius: '0.5rem',
    fontFamily: 'inherit',
    fontSize: '1rem',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '1rem',
    border: '1px solid #e7e5e4',
    padding: '1rem',
  },
} as const;

// =============== DashboardUI ===============
export function DashboardUI({
  profile,
  preferences,
  showMoodSetup,
  showSettings,
  newPostText,
  mediaFiles,
  mediaPreviews,
  posts,
  onlineCount,
  isLoading,
  isSubmitting,
  error,
  fileInputRef,
  handleSaveMoodSetup,
  handleFileChange,
  removeMedia,
  handlePostSubmit,
  toggleAcceptsCalls,
  toggleAcceptsVideoCalls,
  toggleAnonymity,
  updateFullName,
  updateAvatar,
  setShowSettings,
  setShowMoodSetup,
  setNewPostText,
  onConnectClick,
  onCommunitiesClick,
  aboutText,
  setAboutText,
  isEditingAbout,
  setIsEditingAbout,
  isExpanded,
  setIsExpanded,
  saveAbout,
  currentMood,
  setCurrentMood,
}: DashboardUIProps) {
  if (isLoading) {
    return (
      <div style={baseStyles.fullScreenCenter}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '50%',
            border: '4px solid #f59e0b',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}></div>
          <p style={{ color: '#44403c', marginTop: '1rem' }}>Loading your space...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (showMoodSetup) {
    return (
      <MoodSetupModal
        error={error}
        handleSaveMoodSetup={handleSaveMoodSetup}
        isSubmitting={isSubmitting}
        currentMood={currentMood}
        setCurrentMood={setCurrentMood}
      />
    );
  }

  if (showSettings) {
    return (
      <SettingsModal
        profile={profile}
        preferences={preferences}
        error={error}
        setShowSettings={setShowSettings}
        setShowMoodSetup={setShowMoodSetup}
        toggleAcceptsCalls={toggleAcceptsCalls}
        toggleAcceptsVideoCalls={toggleAcceptsVideoCalls}
        toggleAnonymity={toggleAnonymity}
        updateFullName={updateFullName}
        updateAvatar={updateAvatar}
        aboutText={aboutText}
        setAboutText={setAboutText}
        isEditingAbout={isEditingAbout}
        setIsEditingAbout={setIsEditingAbout}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        saveAbout={saveAbout}
        isSubmitting={isSubmitting}
        currentMood={currentMood}
        setCurrentMood={setCurrentMood}
      />
    );
  }

  return (
    <div style={{
      ...baseStyles.container,
      background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
      padding: '1rem',
      paddingBottom: '10rem',
      paddingTop: '3.5rem',
    }}>
      <div style={{
        maxWidth: '1024px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: '2rem',
      }}>
        {error && (
          <div style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            maxWidth: '24rem',
            padding: '1rem',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            zIndex: 50,
          }}>
            {error}
          </div>
        )}

        <ProfileContextSection
          profile={profile}
          setShowSettings={setShowSettings}
          setShowMoodSetup={setShowMoodSetup}
          currentMood={currentMood}
        />

        <CommunityPresence onlineCount={onlineCount} />

        <PostComposer
  onSubmit={handlePostSubmit}
  isSubmitting={isSubmitting}
  placeholder="What's on your mind today? It's safe to share here..."
  maxFiles={4}
  defaultIsAnonymous={preferences.isAnonymous}
/>

        <PostsSection
          posts={posts}
          currentUser={profile}
          currentUserIsAnonymous={preferences.isAnonymous}
        />

        <SupportOptions
          onConnectClick={onConnectClick}
          onCommunitiesClick={onCommunitiesClick}
        />

        <CommunityFooter />
      </div>
    </div>
  );
}

// =============== Reusable Subcomponents with Inline CSS ===============

const MoodSetupModal = ({
  error,
  handleSaveMoodSetup,
  isSubmitting,
  currentMood,
  setCurrentMood,
}: {
  error: string | null;
  handleSaveMoodSetup: () => Promise<void>;
  isSubmitting: boolean;
  currentMood: string;
  setCurrentMood: (mood: string) => void;
}) => (
  <div style={{
    minHeight: '100vh',
    background: 'linear-gradient(to bottom, #f0f7ff, #dbeafe, #bfdbfe)',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'flex-start',
  }}>
    <div style={{ maxWidth: '28rem', width: '100%' }}>
      <h1 style={{
        fontSize: '1.5rem',
        fontWeight: 500,
        color: '#1e40af',
        textAlign: 'center',
        marginBottom: '0.5rem',
      }}>
        How are you feeling today?
      </h1>
      <p style={{
        color: '#4b5563',
        textAlign: 'center',
        marginBottom: '1.5rem',
      }}>
        Sharing your current state helps us connect you with the right support.
      </p>

      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem', marginBottom: '1.5rem' }}>
        {['Struggling today', 'Having mixed feelings', 'Managing okay', 'Feeling hopeful'].map((mood) => (
          <button
            key={mood}
            onClick={() => setCurrentMood(mood)}
            style={{
              ...baseStyles.buttonBase,
              width: '100%',
              textAlign: 'left' as const,
              padding: '1rem',
              border: currentMood === mood
                ? '1px solid #3b82f6'
                : '1px solid #e7e5e4',
              backgroundColor: currentMood === mood
                ? '#dbeafe'
                : '#fff',
              color: currentMood === mood
                ? '#1e40af'
                : '#1c1917',
            }}
          >
            {mood}
            {currentMood === mood && (
              <span style={{ marginLeft: '0.5rem', color: '#3b82f6' }}>✓</span>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={handleSaveMoodSetup}
        disabled={!currentMood || isSubmitting}
        style={{
          ...baseStyles.buttonBase,
          width: '100%',
          padding: '0.75rem',
          backgroundColor: currentMood && !isSubmitting
            ? '#3b82f6'
            : '#d6d3d1',
          color: currentMood && !isSubmitting
            ? '#fff'
            : '#a8a29e',
          cursor: !currentMood || isSubmitting ? 'not-allowed' : 'pointer',
        }}
      >
        {isSubmitting ? 'Saving...' : 'Save & Continue'}
      </button>

      <p style={{
        textAlign: 'center',
        fontSize: '0.75rem',
        color: '#78716c',
        marginTop: '1rem',
      }}>
        You can update this anytime in Settings.
      </p>
    </div>
  </div>
);

const SettingsModal = ({
  profile,
  preferences,
  error,
  setShowSettings,
  setShowMoodSetup,
  toggleAcceptsCalls,
  toggleAcceptsVideoCalls,
  toggleAnonymity,
  updateFullName,
  updateAvatar,
  aboutText,
  setAboutText,
  isEditingAbout,
  setIsEditingAbout,
  isExpanded,
  setIsExpanded,
  saveAbout,
  isSubmitting,
  currentMood,
  setCurrentMood,
}: {
  profile: UserProfile | null;
  preferences: UserPreferences;
  error: string | null;
  setShowSettings: (show: boolean) => void;
  setShowMoodSetup: (show: boolean) => void;
  toggleAcceptsCalls: () => Promise<void>;
  toggleAcceptsVideoCalls: () => Promise<void>;
  toggleAnonymity: () => Promise<void>;
  updateFullName: (firstName: string, lastName: string) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  aboutText: string;
  setAboutText: (text: string) => void;
  isEditingAbout: boolean;
  setIsEditingAbout: (editing: boolean) => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  saveAbout: () => Promise<void>;
  isSubmitting: boolean;
  currentMood: string;
  setCurrentMood: (mood: string) => void;
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (profile?.fullName) {
      const parts = profile.fullName.split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
    } else {
      const email = profile?.email || '';
      if (email) {
        const namePart = email.split('@')[0];
        setFirstName(namePart.charAt(0).toUpperCase() + namePart.slice(1));
        setLastName('');
      }
    }
  }, [profile]);

  const handleSaveName = async () => {
    if (!firstName.trim()) {
      setNameError('First name is required');
      return;
    }
    setNameError(null);
    setIsSavingName(true);
    try {
      await updateFullName(firstName.trim(), lastName.trim());
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f0f7ff',
        padding: '1rem',
        paddingBottom: 'calc(60px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ maxWidth: '28rem', width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e40af' }}>Settings</h2>
          <button
            onClick={() => setShowSettings(false)}
            style={{ color: '#78716c', fontSize: '1.25rem', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fef2f2',
            color: '#dc2626',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {/* Profile Picture Section */}
        <div style={{ ...baseStyles.card, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#dbeafe',
              borderRadius: '0.5rem'
            }}>
              <Camera size={20} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontWeight: 500, color: '#1e40af', marginBottom: '0.75rem' }}>Profile Picture</h3>
              {/* Preview */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                  border: '1px solid #e7e5e4',
                }}>
                  {profile?.avatarUrl ? (
                    <div style={{ width: '100%', height: '100%', borderRadius: '9999px', overflow: 'hidden' }}>
                      <Image
                        src={profile.avatarUrl}
                        alt="Your avatar"
                        width={40}
                        height={40}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#1e40af',
                      fontSize: '1rem',
                      fontWeight: 'bold'
                    }}>
                      {(profile?.fullName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                  {profile?.avatarUrl ? 'Change photo' : 'Add a photo'}
                </span>
              </div>
              {/* Hidden file input */}
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setIsUploadingAvatar(true);
                    setAvatarError(null);
                    try {
                      await updateAvatar(file);
                    } catch (err) {
                      setAvatarError(err instanceof Error ? err.message : 'Upload failed');
                    } finally {
                      setIsUploadingAvatar(false);
                      // Reset input
                      if (e.target) e.target.value = '';
                    }
                  }
                }}
                style={{ display: 'none' }}
                id="avatar-upload"
              />
              <button
                onClick={() => document.getElementById('avatar-upload')?.click()}
                style={{
                  ...baseStyles.buttonBase,
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  fontSize: '0.875rem',
                }}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? 'Uploading...' : profile?.avatarUrl ? 'Change Photo' : 'Add Photo'}
              </button>
              {avatarError && (
                <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  {avatarError}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Display Name Section */}
        <div style={{ ...baseStyles.card, marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#dbeafe',
              borderRadius: '0.5rem'
            }}>
              <User size={20} style={{ color: '#3b82f6' }} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontWeight: 500, color: '#1e40af', marginBottom: '0.75rem' }}>Display Name</h3>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, color: '#3f3f46', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      setNameError(null);
                    }}
                    style={{ ...baseStyles.inputBase, width: '100%' }}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontWeight: 500, color: '#3f3f46', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={{ ...baseStyles.inputBase, width: '100%' }}
                    placeholder="Last name (optional)"
                  />
                </div>
                {nameError && (
                  <div style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>{nameError}</div>
                )}
                <button
                  onClick={handleSaveName}
                  disabled={!firstName.trim() || isSavingName}
                  style={{
                    ...baseStyles.buttonBase,
                    padding: '0.625rem',
                    backgroundColor: firstName.trim() && !isSavingName ? '#3b82f6' : '#d6d3d1',
                    color: firstName.trim() && !isSavingName ? '#fff' : '#a8a29e',
                    cursor: !firstName.trim() || isSavingName ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSavingName ? 'Saving...' : 'Update Display Name'}
                </button>
                <div style={{ fontSize: '0.75rem', color: '#78716c', marginTop: '0.5rem' }}>
                  This name will be used across the platform. You can change it anytime.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 500, color: '#1e40af', marginBottom: '0.5rem' }}>Your Current State</h3>
          <p style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '0.5rem' }}>
            {currentMood || 'Not set'}
          </p>
          <button
            onClick={() => {
              setShowMoodSetup(true);
              setShowSettings(false);
            }}
            style={{ color: '#3b82f6', fontSize: '0.875rem', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Update your mood
          </button>
        </div>

        {/* About Section */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          borderRadius: '0.75rem',
          backgroundColor: '#fff',
          border: '1px solid #e7e5e4',
        }}>
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#1e40af',
            marginBottom: '0.5rem'
          }}>
            About You
          </h3>
          {isEditingAbout ? (
            <div>
              <textarea
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d6d3d1',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                placeholder="Share a bit about yourself... What brings you here? What helps you feel better when you're struggling?"
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d6d3d1'}
              />
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '0.75rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setAboutText(profile?.about || '');
                    setIsEditingAbout(false);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'transparent',
                    color: '#4b5563',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'background-color 0.2s, color 0.2s'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveAbout}
                  disabled={isSubmitting}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: isSubmitting ? '#d6d3d1' : '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    transition: 'background-color 0.2s',
                    opacity: isSubmitting ? 0.8 : 1
                  }}
                >
                  {isSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {profile?.about ? (
                <div style={{
                  position: 'relative',
                  marginBottom: '0.75rem'
                }}>
                  <p style={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    lineHeight: 1.6,
                    color: '#1e40af',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: !isExpanded && profile.about.length > 120 ? 2 : 'unset',
                    transition: 'all 0.3s ease'
                  }}>
                    {profile.about}
                  </p>
                  {profile.about.length > 120 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      style={{
                        marginTop: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#2563eb',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontWeight: 500,
                        padding: '0.25rem 0',
                        transition: 'color 0.2s'
                      }}
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              ) : (
                <p style={{
                  color: '#9ca3af',
                  fontStyle: 'italic',
                  margin: 0,
                  fontSize: '0.875rem'
                }}>
                  Nothing yet. You can share as much or as little as feels safe.
                </p>
              )}
              <button
                onClick={() => setIsEditingAbout(true)}
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#2563eb',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 500,
                  padding: '0.25rem 0',
                  transition: 'color 0.2s'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* 1:1 Support Toggle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'flex',
              gap: '0.75rem',
              cursor: 'pointer',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              border: '1px solid #e7e5e4',
            }}
            onClick={toggleAcceptsCalls}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: '#1e40af' }}>
                {preferences.acceptsCalls ? 'Accepting support calls' : 'Paused for now'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#78716c', marginTop: '0.25rem' }}>
                {preferences.acceptsCalls
                  ? 'You\'ll appear in matches for 1:1 support'
                  : 'You won\'t be matched for calls until you turn this back on'
                }
              </div>
            </div>
            <ToggleLeft
              style={{
                width: '2.5rem',
                height: '1.25rem',
                padding: '0.25rem',
                borderRadius: '9999px',
                backgroundColor: preferences.acceptsCalls ? '#3b82f6' : '#d6d3d1',
                color: preferences.acceptsCalls ? '#fff' : '#78716c',
              }}
            />
          </label>
        </div>

        {/* Video Calls Toggle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              display: 'flex',
              gap: '0.75rem',
              cursor: 'pointer',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              border: '1px solid #e7e5e4',
            }}
            onClick={toggleAcceptsVideoCalls}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, color: '#1e40af' }}>
                {preferences.acceptsVideoCalls ? 'Video calls enabled' : 'Video calls disabled'}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#78716c', marginTop: '0.25rem' }}>
                {preferences.acceptsVideoCalls
                  ? 'You can be invited to video support sessions'
                  : 'You\'ll only be matched for text or audio support'
                }
              </div>
            </div>
            <ToggleLeft
              style={{
                width: '2.5rem',
                height: '1.25rem',
                padding: '0.25rem',
                borderRadius: '9999px',
                backgroundColor: preferences.acceptsVideoCalls ? '#3b82f6' : '#d6d3d1',
                color: preferences.acceptsVideoCalls ? '#fff' : '#78716c',
              }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 500, color: '#1e40af', marginBottom: '0.75rem' }}>Privacy Settings</h3>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' }}>
            <label style={{
              display: 'flex',
              gap: '0.75rem',
              padding: '0.75rem',
              backgroundColor: '#fff',
              borderRadius: '0.5rem',
              border: '1px solid #e7e5e4',
              alignItems: 'flex-start',
            }}>
              <input
                type="checkbox"
                checked={preferences.isAnonymous}
                onChange={toggleAnonymity}
                style={{
                  height: '1.25rem',
                  width: '1.25rem',
                  accentColor: '#3b82f6',
                  marginTop: '0.25rem',
                }}
              />
              <div>
                <div style={{ fontWeight: 500, color: '#1e40af' }}>Post anonymously</div>
                <div style={{ fontSize: '0.875rem', color: '#78716c', marginTop: '0.25rem' }}>
                  Your name and profile picture will not be shown on your posts
                </div>
              </div>
            </label>
            <div style={{
              padding: '0.75rem',
              backgroundColor: '#dbeafe',
              borderRadius: '0.5rem',
              border: '1px solid #bfdbfe',
            }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ marginTop: '0.25rem' }}>
                  <Heart size={20} style={{ color: '#3b82f6' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: '#1e40af' }}>Your safety matters</div>
                  <div style={{ fontSize: '0.875rem', color: '#1e40af', marginTop: '0.25rem' }}>
                    We never share your contact information. All connections happen within our secure platform.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowSettings(false)}
          style={{
            ...baseStyles.buttonBase,
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#1e40af',
            color: '#fff',
            marginTop: '1rem',
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

const ProfileContextSection = ({
  profile,
  setShowSettings,
  setShowMoodSetup,
  currentMood
}: {
  profile: UserProfile | null;
  setShowSettings: (show: boolean) => void;
  setShowMoodSetup: (show: boolean) => void;
  currentMood: string;
}) => {
  const displayName = profile?.fullName || (profile?.email ? profile.email.split('@')[0] : 'Friend');
  const firstName = displayName.split(' ')[0];

  return (
    <div style={{
      ...baseStyles.card,
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 500, color: '#1e40af', marginBottom: '0.25rem' }}>
            Welcome back, {firstName}
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>Your mental health space</p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: '0.625rem',
            color: '#78716c',
            borderRadius: '9999px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          aria-label="Settings"
        >
          <Settings size={20} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Brain size={20} style={{ color: '#3b82f6' }} />
        <span style={{
          backgroundColor: '#dbeafe',
          color: '#1e40af',
          fontSize: '0.875rem',
          padding: '0.375rem 0.75rem',
          borderRadius: '9999px',
          border: '1px solid #bfdbfe',
        }}>
          {currentMood || 'Share how you\'re feeling'}
        </span>
      </div>

      {/* 👇 Insert the View Public Profile link here */}
      {profile?.id && (
        <Link
          href={`/profile/${profile.id}`}
          style={{
            fontSize: '0.75rem',
            color: '#3b82f6',
            textDecoration: 'none',
            display: 'inline-block',
            marginBottom: '0.5rem',
          }}
        >
          👤 View Public Profile
        </Link>
      )}

      <button
        onClick={() => setShowMoodSetup(true)}
        style={{
          fontSize: '0.75rem',
          color: '#3b82f6',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <Edit size={12} />
        Update your mood
      </button>
    </div>
  );
};

const CommunityPresence = ({ onlineCount }: { onlineCount: number }) => (
  <div style={{ textAlign: 'center' as const }}>
    <p style={{ color: '#4b5563', fontWeight: 500 }}>You are not alone</p>
    <div style={{
      marginTop: '0.5rem',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: '#dbeafe',
      padding: '0.5rem 1rem',
      borderRadius: '9999px',
      fontSize: '0.875rem',
      fontWeight: 500,
      color: '#1e40af',
      border: '1px solid #bfdbfe',
    }}>
      <Heart size={14} style={{ color: '#3b82f6', fill: '#dbeafe' }} />
      {onlineCount} people in community right now
    </div>
  </div>
);

const NewPostForm = ({
  profile,
  mediaFiles,
  newPostText,
  mediaPreviews,
  isSubmitting,
  fileInputRef,
  setNewPostText,
  handleFileChange,
  removeMedia,
  handlePostSubmit
}: {
  profile: UserProfile | null;
  mediaFiles: File[];
  newPostText: string;
  mediaPreviews: string[];
  isSubmitting: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  setNewPostText: (text: string) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeMedia: (index: number) => void;
  handlePostSubmit: () => Promise<void>;
}) => (
  <section style={{ ...baseStyles.card, boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)' }}>
    <div style={{ display: 'flex', gap: '0.75rem' }}>
      <div style={{
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '9999px',
        backgroundColor: '#dbeafe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '1px solid #bfdbfe',
      }}>
        {profile?.avatarUrl ? (
          <div style={{ width: '100%', height: '100%', borderRadius: '9999px', overflow: 'hidden' }}>
            <Image
              src={profile.avatarUrl}
              alt="Your avatar"
              width={40}
              height={40}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              unoptimized
            />
          </div>
        ) : (
          <div style={{ color: '#1e40af', fontWeight: 500, fontSize: '0.875rem' }}>
            {(profile?.fullName || 'U').charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <textarea
          value={newPostText}
          onChange={(e) => setNewPostText(e.target.value)}
          placeholder="What's on your mind today? It's safe to share here..."
          style={{
            width: '100%',
            padding: '0.5rem',
            color: '#1e40af',
            backgroundColor: 'transparent',
            border: '1px solid #e7e5e4',
            borderRadius: '0.5rem',
            resize: 'none',
            fontFamily: 'inherit',
            fontSize: '1rem',
            minHeight: '4rem',
            outline: 'none',
          }}
          disabled={isSubmitting}
        />
        {mediaPreviews.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem', marginTop: '0.75rem' }}>
            {mediaPreviews.map((url, i) => (
              <div key={i} style={{
                position: 'relative',
                width: '5rem',
                height: '5rem',
                borderRadius: '0.5rem',
                overflow: 'hidden',
                border: '1px solid #e7e5e4',
              }}>
                {/* Use <img> instead of <Image> for blob URLs */}
                <img
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '0.5rem',
                  }}
                />
                <button
                  onClick={() => removeMedia(i)}
                  style={{
                    position: 'absolute',
                    top: '-0.25rem',
                    right: '-0.25rem',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '9999px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  aria-label="Remove attachment"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{
          display: 'flex',
          flexDirection: 'column' as const,
          gap: '0.75rem',
          marginTop: '1rem',
          paddingTop: '0.75rem',
          borderTop: '1px solid #f5f5f4',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#78716c',
                fontSize: '0.875rem',
                fontWeight: 500,
                padding: '0.375rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: isSubmitting || mediaFiles.length >= 4 ? 'not-allowed' : 'pointer',
              }}
              disabled={isSubmitting || mediaFiles.length >= 4}
            >
              <Camera size={16} />
              {mediaFiles.length > 0 ? `Add more (${4 - mediaFiles.length} left)` : 'Add photo/video'}
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
          />
          <button
            onClick={handlePostSubmit}
            disabled={!newPostText.trim() || isSubmitting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.75rem',
              fontWeight: 500,
              fontSize: '0.875rem',
              backgroundColor: newPostText.trim() && !isSubmitting
                ? '#3b82f6'
                : '#d6d3d1',
              color: newPostText.trim() && !isSubmitting
                ? '#fff'
                : '#a8a29e',
              cursor: !newPostText.trim() || isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: newPostText.trim() && !isSubmitting ? '0 4px 6px -1px rgba(59,130,246,0.1)' : 'none',
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '1rem',
                  height: '1rem',
                  borderRadius: '50%',
                  border: '2px solid white',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                }}></div>
                Sharing...
              </>
            ) : (
              <>
                Share
                <Send size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  </section>
);

const PostsSection = ({
  posts,
  currentUser,
  currentUserIsAnonymous
}: {
  posts: Post[];
  currentUser: UserProfile | null;
  currentUserIsAnonymous: boolean;
}) => (
  <section>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1e40af' }}>
        Shared Experiences
      </h2>
      <span style={{ color: '#78716c', fontSize: '0.875rem' }}>
        {posts.length} post{posts.length !== 1 ? 's' : ''}
      </span>
    </div>
    {posts.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#78716c' }}>
        No experiences shared yet. Be the first to share yours.
      </div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            isOwner={post.userId === currentUser?.id}
            canDelete={post.userId === currentUser?.id}
            showAuthor={true}
            context="feed"
            onPostDeleted={() => {
              // Optional: trigger refetch or filter optimistically
            }}
          />
        ))}
      </div>
    )}
  </section>
);

const SupportOptions = ({
  onConnectClick,
  onCommunitiesClick
}: {
  onConnectClick: () => void;
  onCommunitiesClick: () => void;
}) => (
  <section>
    <h2 style={{ fontWeight: 600, color: '#1e40af', marginBottom: '1rem', fontSize: '1.125rem' }}>Find Support</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
      <button
        onClick={onConnectClick}
        style={{
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          borderRadius: '1rem',
          border: '2px solid #e7e5e4',
          backgroundColor: '#fff',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
      >
        <div style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '9999px',
          backgroundColor: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          <MessageCircle style={{ color: '#3b82f6' }} size={28} />
        </div>
        <span style={{ fontWeight: 500, color: '#1e40af' }}>
          1:1 Support
        </span>
        <span style={{ fontSize: '0.75rem', color: '#78716c', textAlign: 'center', marginTop: '0.25rem' }}>
          Connect with someone who understands
        </span>
      </button>
      <button
        onClick={onCommunitiesClick}
        style={{
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          borderRadius: '1rem',
          border: '2px solid #e7e5e4',
          backgroundColor: '#fff',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}
      >
        <div style={{
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '9999px',
          backgroundColor: '#dbeafe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.75rem',
        }}>
          <Users style={{ color: '#3b82f6' }} size={28} />
        </div>
        <span style={{ fontWeight: 500, color: '#1e40af' }}>
          Communities
        </span>
        <span style={{ fontSize: '0.75rem', color: '#78716c', textAlign: 'center', marginTop: '0.25rem' }}>
          Join groups with shared experiences
        </span>
      </button>
    </div>
  </section>
);

const CommunityFooter = () => (
  <div style={{
    textAlign: 'center' as const,
    paddingTop: '1.5rem',
    borderTop: '1px solid #e7e5e4',
    marginTop: '1.5rem',
  }}>
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      backgroundColor: '#dbeafe',
      color: '#1e40af',
      padding: '0.5rem 1rem',
      borderRadius: '9999px',
      border: '1px solid #bfdbfe',
    }}>
      <Heart size={16} style={{ color: '#3b82f6', fill: '#dbeafe' }} />
      <span style={{ fontWeight: 500 }}>You belong here</span>
    </div>
    <p style={{ color: '#78716c', fontSize: '0.875rem', marginTop: '0.5rem' }}>
      This is a judgment-free space for your mental health journey
    </p>
  </div>
);