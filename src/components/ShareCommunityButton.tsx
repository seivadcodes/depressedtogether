// src/components/ShareCommunityButton.tsx
'use client';

import { useState, CSSProperties } from 'react';
import { ExternalLink, Share2, Copy, MessageCircle, Twitter, Facebook } from 'lucide-react';

// Define reusable inline styles (you can move these to a theme file later)
const dropdownItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.375rem 0.75rem',
  fontSize: '0.875rem',
  cursor: 'pointer',
  borderRadius: '0.375rem',
};

const dropdownStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 10,
  marginTop: '0.25rem',
  width: '12rem',
  backgroundColor: 'white',
  borderRadius: '0.5rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  padding: '0.25rem',
};

type ToastFunction = (message: string) => void;

type ShareCommunityButtonProps = {
  communityId: string;
  communityName: string;
  communityDescription?: string;
  toast?: ToastFunction;
  style: CSSProperties; // required: your outlineButtonStyle + sizing
};

export function ShareCommunityButton({
  communityId,
  communityName,
  communityDescription,
  toast: customToast,
  style,
}: ShareCommunityButtonProps) {
  const [showPlatformOptions, setShowPlatformOptions] = useState(false);

  const slugify = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const communitySlug = slugify(communityName);
  const shareUrl = `${window.location.origin}/community/${communityId}/${communitySlug}`;

  const fallbackToast = (message: string) => {
    if (customToast) {
      customToast(message);
    } else {
      console.log(message);
    }
  };

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        const shareText = communityDescription
          ? `${communityDescription.substring(0, 120)}…`
          : `A compassionate space for shared grief and support.`;
        await navigator.share({ title: `Join ${communityName}`, text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.warn('Web Share failed, falling back to copy');
        }
      }
    }
    await copyToClipboard();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      fallbackToast('Link copied! Share it anywhere.');
    } catch {
      fallbackToast('Failed to copy link');
    }
  };

  const shareToPlatform = (platform: 'whatsapp' | 'twitter' | 'facebook') => {
    let url = '';
    const baseText = communityDescription
      ? `${communityName}: ${communityDescription.substring(0, 100)}`
      : `Join me in ${communityName} — a compassionate space for grief support.`;
    const encodedText = encodeURIComponent(baseText);

    switch (platform) {
      case 'whatsapp':
        url = `https://wa.me/?text=${encodedText}%20${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    setShowPlatformOptions(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Main Share Button — styled exactly like your Invite button */}
      <button
        onClick={handleWebShare}
        style={style}
        aria-label="Share this community"
      >
        <Share2 size={16} style={{ marginRight: '0.25rem' }} />
        Share
      </button>

      {/* Small "more options" icon next to it */}
      <button
        onClick={() => setShowPlatformOptions(!showPlatformOptions)}
        style={{
          ...style,
          marginLeft: '0.25rem',
          padding: '0.25rem',
          minWidth: 'auto',
          minHeight: 'auto',
        }}
        aria-label="More share options"
      >
        <ExternalLink size={14} />
      </button>

      {/* Dropdown Menu */}
      {showPlatformOptions && (
        <div style={dropdownStyle}>
          <button
            onClick={() => shareToPlatform('whatsapp')}
            style={{
              ...dropdownItemStyle,
              color: '#10B981',
            }}
          >
            <MessageCircle size={14} />
            WhatsApp
          </button>
          <button
            onClick={() => shareToPlatform('twitter')}
            style={{
              ...dropdownItemStyle,
              color: '#3B82F6',
            }}
          >
            <Twitter size={14} />
            Twitter
          </button>
          <button
            onClick={() => shareToPlatform('facebook')}
            style={{
              ...dropdownItemStyle,
              color: '#2563EB',
            }}
          >
            <Facebook size={14} />
            Facebook
          </button>
          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
            <button
              onClick={copyToClipboard}
              style={{
                ...dropdownItemStyle,
                color: '#4B5563',
              }}
            >
              <Copy size={14} />
              Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}