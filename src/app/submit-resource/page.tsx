// src/app/submit-resource/page.tsx
'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { BookOpen, Upload, Link as LinkIcon, AlertTriangle, Brain, Heart } from 'lucide-react';
import Image from 'next/image';

const CATEGORIES: Record<string, string> = {
  Story: 'Personal Stories',
  Guide: 'Guidance',
  Tool: 'Tools',
  Video: 'Videos',
  Book: 'Books',
};

const TAG_SUGGESTIONS = [
  'depression', 'anxiety', 'sadness', 'hopelessness', 'fatigue', 'insomnia',
  'therapy', 'medication', 'self-care', 'mindfulness', 'coping', 'support',
  'isolation', 'recovery', 'relapse', 'treatment', 'meditation', 'exercise'
];

export default function SubmitResourcePage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  type ResourceType = 'Story' | 'Guide' | 'Tool' | 'Video' | 'Book';

  const [formData, setFormData] = useState({
    title: '',
    excerpt: '',
    type: 'Story' as ResourceType,
    tags: [] as string[],
    contentWarnings: [] as string[],
    communitySource: '',
    bookAuthor: '',
    bookQuote: '',
    externalUrl: '',
    videoType: 'link' as 'link' | 'upload',
    videoFile: null as File | null,
    videoPreview: '' as string,
    bookCoverFile: null as File | null,
    bookCoverPreview: '' as string,
  });

  const [newTag, setNewTag] = useState('');
  const [newWarning, setNewWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleTagAdd = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim()) && formData.tags.length < 5) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleWarningAdd = () => {
    if (newWarning.trim() && !formData.contentWarnings.includes(newWarning.trim())) {
      setFormData({ ...formData, contentWarnings: [...formData.contentWarnings, newWarning.trim()] });
      setNewWarning('');
    }
  };

  const handleTagRemove = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
  };

  const handleWarningRemove = (warning: string) => {
    setFormData({ ...formData, contentWarnings: formData.contentWarnings.filter(w => w !== warning) });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleVideoTypeChange = (type: 'link' | 'upload') => {
    setFormData(prev => ({
      ...prev,
      videoType: type,
      externalUrl: type === 'link' ? prev.externalUrl : '',
      videoFile: type === 'upload' ? prev.videoFile : null,
      videoPreview: type === 'upload' ? prev.videoPreview : '',
    }));
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    
    if (file) {
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      const maxSize = 100 * 1024 * 1024; // 100MB
      
      if (!validTypes.includes(file.type)) {
        setErrorMessage('Invalid file type. Please upload MP4, WebM, or MOV files.');
        setSubmitStatus('error');
        return;
      }
      
      if (file.size > maxSize) {
        setErrorMessage('File too large. Maximum size is 100MB.');
        setSubmitStatus('error');
        return;
      }
      
      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        videoFile: file,
        videoPreview: previewUrl,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        videoFile: null,
        videoPreview: '',
      }));
    }
  };

  const handleBookCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        setErrorMessage('Please upload a JPG, PNG, or WebP image.');
        setSubmitStatus('error');
        return;
      }
      if (file.size > maxSize) {
        setErrorMessage('Image too large. Max size is 5MB.');
        setSubmitStatus('error');
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setFormData(prev => ({
        ...prev,
        bookCoverFile: file,
        bookCoverPreview: previewUrl,
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        bookCoverFile: null,
        bookCoverPreview: '',
      }));
    }
  };

  const uploadBookCover = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileName = `${user.id}/${Date.now()}_cover_${file.name}`;
    const { error } = await supabase.storage
      .from('book-covers')
      .upload(fileName, file, { upsert: true });

    if (error) throw error;
    return `book-covers/${fileName}`;
  };

  const uploadVideo = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileName = `${user.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage
      .from('videos')
      .upload(fileName, file, { upsert: true, contentType: file.type });

    if (error) throw error;
    return `videos/${fileName}`;
  };

  const validate = () => {
    if (!formData.title.trim() || formData.title.length < 5) {
      return 'Title is required (min 5 characters).';
    }
    if (!formData.excerpt.trim() || formData.excerpt.length < 20) {
      return 'Please share a meaningful reflection (min 20 characters).';
    }
    if (formData.tags.length === 0) {
      return 'Please add at least one tag.';
    }
    
    if (formData.type === 'Book') {
      if (!formData.bookAuthor.trim()) return 'Book author is required.';
      if (!formData.bookQuote.trim() || formData.bookQuote.length > 150) {
        return 'Book quote is required and should be under 150 characters.';
      }
      try {
        new URL(formData.externalUrl);
      } catch {
        return 'Please provide a valid book link.';
      }
    }
    
    if (formData.type === 'Video') {
      if (formData.videoType === 'link') {
        if (!formData.externalUrl.trim()) {
          return 'Video link is required.';
        }
        try {
          new URL(formData.externalUrl);
        } catch {
          return 'Please provide a valid video URL.';
        }
      } else if (formData.videoType === 'upload') {
        if (!formData.videoFile) {
          return 'Please select a video file to upload.';
        }
      }
    }
    
    if (formData.externalUrl && formData.type !== 'Book' && formData.type !== 'Video') {
      try {
        new URL(formData.externalUrl);
      } catch {
        return 'Please provide a valid URL.';
      }
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      setErrorMessage(error);
      setSubmitStatus('error');
      return;
    }

    let bookCoverPath = null;
    if (formData.type === 'Book' && formData.bookCoverFile) {
      bookCoverPath = await uploadBookCover(formData.bookCoverFile);
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');
    setIsUploading(false);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be signed in to submit.');
      }

      let videoPath = null;
      if (formData.type === 'Video' && formData.videoType === 'upload' && formData.videoFile) {
        setIsUploading(true);
        videoPath = await uploadVideo(formData.videoFile);
        setIsUploading(false);
      }

      const { error: supabaseError } = await supabase
        .from('resources')
        .insert({
          user_id: user.id,
          title: formData.title.trim(),
          excerpt: formData.excerpt.trim(),
          type: formData.type,
          category: CATEGORIES[formData.type],
          book_cover_url: bookCoverPath,
          tags: formData.tags,
          content_warnings: formData.contentWarnings,
          community_source: formData.communitySource || null,
          book_author: formData.type === 'Book' ? formData.bookAuthor.trim() : null,
          book_quote: formData.type === 'Book' ? formData.bookQuote.trim() : null,
          external_url: formData.type === 'Video' && formData.videoType === 'link'
            ? formData.externalUrl.trim()
            : formData.type !== 'Video' && formData.externalUrl
              ? formData.externalUrl.trim()
              : null,
          video_url: formData.type === 'Video' ? (videoPath || null) : null,
          video_type: formData.type === 'Video' ? formData.videoType : null,
          status: 'pending',
          is_curated: false,
        });

      if (supabaseError) {
        throw supabaseError;
      }

      setSubmitStatus('success');
      
      setFormData({
        title: '',
        excerpt: '',
        type: 'Story',
        tags: [],
        contentWarnings: [],
        communitySource: '',
        bookAuthor: '',
        bookQuote: '',
        externalUrl: '',
        videoType: 'link',
        videoFile: null,
        videoPreview: '',
        bookCoverFile: null,
        bookCoverPreview: '',
      });
      
    } catch (error: unknown) {
      let message = 'Failed to submit. Please try again.';
      if (error instanceof Error) {
        message = error.message;
      }
      console.error('Submission error:', error);
      setErrorMessage(message);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f0f7ff', 
      padding: '1.5rem 1rem',
      background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
    }}>
      <div style={{ 
        maxWidth: '640px', 
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2rem',
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '1rem',
          padding: '1.5rem',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        }}>
          <div style={{
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            color: '#1e40af',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 0.75rem',
            border: '2px solid #3b82f6',
          }}>
            <Brain size={20} />
          </div>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '800', 
            color: '#1e40af',
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem'
          }}>
            Share a Resource
          </h1>
          <p style={{ color: '#4b5563', fontSize: '1.125rem' }}>
            Your experience can help others who understand depression
          </p>
        </div>

        {submitStatus === 'success' ? (
          <div style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(10px)',
            padding: '1.5rem', 
            borderRadius: '1rem', 
            textAlign: 'center',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          }}>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              color: '#047857',
            }}>
              <Heart size={20} />
            </div>
            <p style={{ color: '#1e40af', fontWeight: '600', fontSize: '1.125rem' }}>
              Thank you! Your resource has been submitted for review.
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Approved resources appear on the{' '}
              <Link 
                href="/resources" 
                style={{ 
                  color: '#3b82f6', 
                  fontWeight: '600',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
              >
                Resources
              </Link>{' '}
              page.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(10px)',
            padding: '1.5rem', 
            borderRadius: '1rem', 
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}>
            {submitStatus === 'error' && (
              <div style={{ 
                backgroundColor: '#fee2e2', 
                color: '#b91c1c', 
                padding: '0.75rem', 
                borderRadius: '0.5rem', 
                marginBottom: '1rem', 
                display: 'flex', 
                gap: '0.5rem', 
                alignItems: 'flex-start',
                border: '1px solid #fecaca',
              }}>
                <AlertTriangle size={18} style={{ marginTop: '0.25rem', flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Type */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1e40af'
              }}>
                Resource Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
                  transition: 'all 150ms ease-in-out',
                  cursor: 'pointer',
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              >
                <option value="Story">Personal Story</option>
                <option value="Guide">Guide / Advice</option>
                <option value="Tool">Tool / Template</option>
                <option value="Video">Video</option>
                <option value="Book">Book Recommendation</option>
              </select>
            </div>

            {/* Title */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1e40af'
              }}>
                Title
              </label>
              <input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder={
                  formData.type === 'Book' 
                    ? "Book title" 
                    : formData.type === 'Video'
                      ? "Video title"
                      : "A meaningful title about depression support"
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
                  transition: 'all 150ms ease-in-out',
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            {/* Excerpt */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1e40af'
              }}>
                {formData.type === 'Book'
                  ? 'Why this book helped you'
                  : formData.type === 'Video'
                    ? 'Video description and why it helped'
                    : 'Your reflection or summary'}
              </label>
              <textarea
                name="excerpt"
                value={formData.excerpt}
                onChange={handleChange}
                rows={4}
                placeholder={
                  formData.type === 'Book'
                    ? "e.g., 'This book helped me understand my depression in a new way...'"
                    : formData.type === 'Video'
                      ? "e.g., 'This video helped me feel less alone in my struggle...'"
                      : "Share what this resource offers or your experience with depression"
                }
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  transition: 'all 150ms ease-in-out',
                  minHeight: '120px',
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            {/* Video Options */}
            {formData.type === 'Video' && (
              <div style={{ 
                marginBottom: '1.5rem', 
                border: '1px solid rgba(59, 130, 246, 0.2)', 
                borderRadius: '0.75rem', 
                padding: '1.25rem',
                backgroundColor: 'rgba(219, 234, 254, 0.3)',
              }}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => handleVideoTypeChange('link')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: formData.videoType === 'link' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.75rem',
                      backgroundColor: formData.videoType === 'link' ? '#dbeafe' : 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: formData.videoType === 'link' ? '#1e40af' : '#4b5563',
                      fontWeight: formData.videoType === 'link' ? '600' : '400',
                      cursor: 'pointer',
                      transition: 'all 150ms ease-in-out',
                    }}
                  >
                    <LinkIcon size={20} />
                    <span style={{ fontSize: '0.875rem' }}>Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVideoTypeChange('upload')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: formData.videoType === 'upload' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '0.75rem',
                      backgroundColor: formData.videoType === 'upload' ? '#dbeafe' : 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: formData.videoType === 'upload' ? '#1e40af' : '#4b5563',
                      fontWeight: formData.videoType === 'upload' ? '600' : '400',
                      cursor: 'pointer',
                      transition: 'all 150ms ease-in-out',
                    }}
                  >
                    <Upload size={20} />
                    <span style={{ fontSize: '0.875rem' }}>Upload</span>
                  </button>
                </div>

                {formData.videoType === 'link' ? (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af'
                    }}>
                      Video Link
                    </label>
                    <input
                      name="externalUrl"
                      value={formData.externalUrl}
                      onChange={handleChange}
                      placeholder="https://youtube.com/watch?v=..."
                      type="url"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.75rem',
                        backgroundColor: 'white',
                        color: '#374151',
                        fontSize: '0.875rem',
                        transition: 'all 150ms ease-in-out',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                      required
                    />
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      Supported platforms: YouTube, Vimeo, Loom, Google Drive, Dropbox
                    </p>
                  </div>
                ) : (
                  <div>
                    <label style={{ 
                      display: 'block', 
                      marginBottom: '0.5rem', 
                      fontWeight: '600',
                      color: '#1e40af'
                    }}>
                      Upload Video (max 100MB)
                    </label>
                    <div 
                      style={{ 
                        border: '2px dashed #d1d5db', 
                        borderRadius: '0.75rem',
                        padding: '1.5rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: formData.videoPreview ? '#f8fafc' : 'white',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 150ms ease-in-out',
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="video/mp4,video/webm,video/quicktime"
                        style={{ display: 'none' }}
                        onChange={handleVideoFileChange}
                      />
                      
                      {formData.videoPreview ? (
                        <div>
                          <video 
                            src={formData.videoPreview} 
                            controls
                            style={{ 
                              maxWidth: '100%',
                              maxHeight: '150px',
                              borderRadius: '0.5rem',
                              marginBottom: '0.5rem',
                              backgroundColor: '#000',
                            }} 
                          />
                          <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1e40af' }}>
                            {formData.videoFile?.name}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            Click to change video
                          </p>
                        </div>
                      ) : (
                        <div>
                          <Upload size={32} style={{ color: '#9ca3af', margin: '0 auto 0.5rem' }} />
                          <p style={{ fontSize: '0.875rem', fontWeight: '500', color: '#4b5563' }}>
                            Click to upload video
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            MP4, WebM, or MOV (max 100MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Book fields */}
            {formData.type === 'Book' && (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af'
                  }}>
                    Author
                  </label>
                  <input
                    name="bookAuthor"
                    value={formData.bookAuthor}
                    onChange={handleChange}
                    placeholder="e.g., Andrew Solomon"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.75rem',
                      backgroundColor: 'white',
                      color: '#374151',
                      fontSize: '0.875rem',
                      transition: 'all 150ms ease-in-out',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af'
                  }}>
                    Short Quote (max 150 chars)
                  </label>
                  <input
                    name="bookQuote"
                    value={formData.bookQuote}
                    onChange={handleChange}
                    placeholder="e.g., 'The opposite of depression is not happiness, but vitality.'"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.75rem',
                      backgroundColor: 'white',
                      color: '#374151',
                      fontSize: '0.875rem',
                      transition: 'all 150ms ease-in-out',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af'
                  }}>
                    Link to Book
                  </label>
                  <input
                    name="externalUrl"
                    value={formData.externalUrl}
                    onChange={handleChange}
                    placeholder="https://bookshop.org/..."
                    type="url"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.75rem',
                      backgroundColor: 'white',
                      color: '#374151',
                      fontSize: '0.875rem',
                      transition: 'all 150ms ease-in-out',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: '600',
                    color: '#1e40af'
                  }}>
                    Book Cover (optional)
                  </label>
                  <div
                    style={{
                      border: '2px dashed #d1d5db',
                      borderRadius: '0.75rem',
                      padding: '1.25rem',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: '#f9fafb',
                      transition: 'all 150ms ease-in-out',
                    }}
                    onClick={() => document.getElementById('bookCoverInput')?.click()}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                  >
                    <input
                      id="bookCoverInput"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleBookCoverChange}
                    />
                    {formData.bookCoverPreview ? (
                      <Image
                        src={formData.bookCoverPreview}
                        alt="Book cover preview"
                        height={150}
                        width={100}
                        style={{
                          maxHeight: '150px',
                          maxWidth: '100%',
                          borderRadius: '0.5rem',
                          objectFit: 'contain',
                          margin: '0 auto',
                        }}
                        unoptimized
                      />
                    ) : (
                      <div>
                        <Upload size={24} style={{ color: '#9ca3af', margin: '0 auto 0.5rem' }} />
                        <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                          Click to upload cover (JPG/PNG, max 5MB)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* External URL for non-video, non-book resources */}
            {formData.type !== 'Book' && formData.type !== 'Video' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: '600',
                  color: '#1e40af'
                }}>
                  Resource Link (optional)
                </label>
                <input
                  name="externalUrl"
                  value={formData.externalUrl}
                  onChange={handleChange}
                  placeholder="e.g., article URL, tool website, PDF document"
                  type="url"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.75rem',
                    backgroundColor: 'white',
                    color: '#374151',
                    fontSize: '0.875rem',
                    transition: 'all 150ms ease-in-out',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>
            )}

            {/* Community Source */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1e40af'
              }}>
                Shared in community (optional)
              </label>
              <input
                name="communitySource"
                value={formData.communitySource}
                onChange={handleChange}
                placeholder="e.g., Depression Support Group"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.75rem',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '0.875rem',
                  transition: 'all 150ms ease-in-out',
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1e40af'
              }}>
                Tags (up to 5)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleTagAdd())}
                  placeholder="Add a tag (e.g., depression, self-care)"
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    color: '#374151',
                    transition: 'all 150ms ease-in-out',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button
                  type="button"
                  onClick={handleTagAdd}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#dbeafe',
                    border: '1px solid #3b82f6',
                    borderRadius: '9999px',
                    fontWeight: '600',
                    color: '#1e40af',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-in-out',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dbeafe'}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#1e40af', 
                        fontSize: '1rem',
                        cursor: 'pointer',
                        padding: 0,
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                Suggestions: {TAG_SUGGESTIONS.slice(0, 6).join(', ')}
              </div>
            </div>

            {/* Content Warnings */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontWeight: '600',
                color: '#1e40af'
              }}>
                Content Warnings (optional)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  value={newWarning}
                  onChange={(e) => setNewWarning(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleWarningAdd())}
                  placeholder="e.g., suicide mention, self-harm"
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '9999px',
                    fontSize: '0.875rem',
                    backgroundColor: 'white',
                    color: '#374151',
                    transition: 'all 150ms ease-in-out',
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button
                  type="button"
                  onClick={handleWarningAdd}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#f3e8ff',
                    border: '1px solid #8b5cf6',
                    borderRadius: '9999px',
                    fontWeight: '600',
                    color: '#7c3aed',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-in-out',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#8b5cf6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3e8ff'}
                >
                  Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                {formData.contentWarnings.map(warning => (
                  <span
                    key={warning}
                    style={{
                      padding: '0.375rem 0.75rem',
                      backgroundColor: '#f3e8ff',
                      color: '#7c3aed',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    {warning}
                    <button
                      type="button"
                      onClick={() => handleWarningRemove(warning)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: '#7c3aed', 
                        fontSize: '1rem',
                        cursor: 'pointer',
                        padding: 0,
                        width: '16px',
                        height: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: isSubmitting || isUploading 
                  ? 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)' 
                  : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: isSubmitting || isUploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 300ms ease-in-out',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting && !isUploading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting && !isUploading) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              {isUploading ? (
                <>
                  <span>Uploading video...</span>
                  <div style={{ 
                    width: '1rem', 
                    height: '1rem', 
                    border: '2px solid white', 
                    borderTopColor: 'transparent', 
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                </>
              ) : isSubmitting ? (
                'Submitting...'
              ) : (
                <>
                  <BookOpen size={18} />
                  Submit for Review
                </>
              )}
            </button>
          </form>
        )}

        <div style={{ 
          marginTop: '2rem', 
          textAlign: 'center', 
          fontSize: '0.875rem', 
          color: '#4b5563',
          padding: '1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '0.75rem',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}>
          <p><strong>Important:</strong> All submissions are reviewed before appearing publicly..</p>
          <p style={{ marginTop: '0.25rem' }}>
            Video uploads are stored securely and only accessible after approval.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}