'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Heart, Users, MessageCircle } from 'lucide-react';

const createSession = async () => {
  await new Promise(resolve => setTimeout(resolve, 800));
  // Session creation logic can be expanded later if needed
};

export default function HomePage() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const heartbeatRef = useRef<HTMLDivElement>(null);
  const [onlineCount, setOnlineCount] = useState(42); // Mock count

  useEffect(() => {
    const startPulse = () => {
      if (!heartbeatRef.current) return;
      heartbeatRef.current.style.opacity = '0.9';
      setTimeout(() => {
        if (heartbeatRef.current) {
          heartbeatRef.current.style.opacity = '1';
        }
      }, 500);
    };

    const pulseInterval = setInterval(startPulse, 4000);
    
    // Simulate online count updates
    const countInterval = setInterval(() => {
      setOnlineCount(prev => {
        const change = Math.floor(Math.random() * 7) - 3;
        return Math.max(20, prev + change);
      });
    }, 10000);

    return () => {
      clearInterval(pulseInterval);
      clearInterval(countInterval);
    };
  }, []);

  const handleQuickConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await createSession(); // No need to store or use session ID yet
      router.push(`/connect`);
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Unable to connect right now. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleFindCommunity = () => {
    router.push('/communities');
  };

  const handleLearnMore = () => {
    router.push('/about');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
        padding: '1rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 2px, transparent 2px)`,
        backgroundSize: '40px 40px',
        opacity: 0.5,
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '48rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginTop: '3rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Brain size={32} style={{ color: '#3b82f6' }} />
            <h1 style={{
              fontSize: '3rem',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
            }}>
              Depressed Together
            </h1>
          </div>
          <p style={{
            fontSize: '1.25rem',
            color: '#4b5563',
            maxWidth: '36rem',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            You&apos;re not alone in this. Connect with others who understand what depression feels like.
          </p>
        </div>

        {/* Main Heartbeat Circle */}
        <div
          ref={heartbeatRef}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18rem',
            height: '18rem',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, rgba(219, 234, 254, 0.9) 0%, rgba(191, 219, 254, 0.9) 100%)',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            boxShadow: `
              0 20px 40px rgba(59, 130, 246, 0.15),
              inset 0 1px 0 rgba(255, 255, 255, 0.5)
            `,
            margin: '3rem auto',
            transition: 'all 1s ease',
            opacity: 1,
            zIndex: 1,
          }}
        >
          {/* Pulsing ring effect */}
          <div style={{
            position: 'absolute',
            top: '-20px',
            left: '-20px',
            right: '-20px',
            bottom: '-20px',
            borderRadius: '9999px',
            border: '2px solid rgba(59, 130, 246, 0.1)',
            animation: 'pulse 4s infinite',
          }} />
          
          <div style={{ textAlign: 'center', padding: '0 2rem', zIndex: 2 }}>
            <Heart size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.75rem', fontWeight: '600', color: '#1e40af', marginBottom: '0.5rem' }}>
              {onlineCount} people understand
            </h2>
            <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>
              Right now. Right here.
            </p>
          </div>
        </div>

        {/* Online Indicator */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '2.5rem',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          borderRadius: '9999px',
          padding: '0.75rem 1.5rem',
          display: 'inline-block',
          margin: '0 auto 2rem',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '0.95rem',
            fontWeight: '600',
            color: '#1e40af',
            gap: '0.5rem',
          }}>
            <span style={{ 
              width: '0.75rem', 
              height: '0.75rem', 
              backgroundColor: '#10b981', 
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'pulse 2s infinite',
            }}></span>
            {onlineCount} people available to connect
          </span>
        </div>

        {/* Primary Action Buttons */}
        <div style={{ 
          width: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1rem', 
          marginBottom: '3rem',
          maxWidth: '32rem',
          margin: '0 auto',
        }}>
          <button
            onClick={handleQuickConnect}
            disabled={isConnecting}
            style={{
              width: '100%',
              padding: '1.25rem',
              background: isConnecting 
                ? 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)' 
                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              fontWeight: '600',
              fontSize: '1.125rem',
              borderRadius: '1rem',
              border: 'none',
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              boxShadow: '0 8px 25px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
            onMouseEnter={(e) => {
              if (!isConnecting) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isConnecting) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.3)';
              }
            }}
          >
            {isConnecting ? (
              <>
                <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
                </svg>
                Connecting you...
              </>
            ) : (
              <>
                <MessageCircle size={24} />
                Find Support Now
              </>
            )}
          </button>

          <button
            onClick={handleFindCommunity}
            style={{
              width: '100%',
              padding: '1.25rem',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              color: '#1e40af',
              fontWeight: '600',
              fontSize: '1.125rem',
              borderRadius: '1rem',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.05)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.1)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            }}
          >
            <Users size={24} />
            Join Community
          </button>

          <button
            onClick={handleLearnMore}
            style={{
              width: '100%',
              padding: '1rem',
              background: 'transparent',
              color: '#6b7280',
              fontWeight: '600',
              fontSize: '1rem',
              borderRadius: '1rem',
              border: '1px solid rgba(203, 213, 225, 0.5)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
              e.currentTarget.style.color = '#1e40af';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            Learn how it works →
          </button>
        </div>

        {/* Features Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginTop: '3rem',
          marginBottom: '4rem',
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid rgba(59, 130, 246, 0.1)',
            textAlign: 'center',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px)';
            e.currentTarget.style.boxShadow = '0 15px 35px rgba(59, 130, 246, 0.1)';
            e.currentTarget.style.borderColor = '#3b82f6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.1)';
          }}
          >
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <MessageCircle size={24} style={{ color: '#3b82f6' }} />
            </div>
            <h3 style={{ fontWeight: '700', color: '#1e40af', marginBottom: '0.5rem' }}>Safe Space</h3>
            <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
              No judgments, just understanding from people who get it.
            </p>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid rgba(139, 92, 246, 0.1)',
            textAlign: 'center',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px)';
            e.currentTarget.style.boxShadow = '0 15px 35px rgba(139, 92, 246, 0.1)';
            e.currentTarget.style.borderColor = '#8b5cf6';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.1)';
          }}
          >
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <Users size={24} style={{ color: '#8b5cf6' }} />
            </div>
            <h3 style={{ fontWeight: '700', color: '#7c3aed', marginBottom: '0.5rem' }}>Together</h3>
            <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Connect with others who understand depression firsthand.
            </p>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            border: '1px solid rgba(16, 185, 129, 0.1)',
            textAlign: 'center',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-8px)';
            e.currentTarget.style.boxShadow = '0 15px 35px rgba(16, 185, 129, 0.1)';
            e.currentTarget.style.borderColor = '#10b981';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.1)';
          }}
          >
            <div style={{
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}>
              <Brain size={24} style={{ color: '#10b981' }} />
            </div>
            <h3 style={{ fontWeight: '700', color: '#047857', marginBottom: '0.5rem' }}>Hope</h3>
            <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Find moments of connection when you need them most.
            </p>
          </div>
        </div>

        {/* Footer Note */}
        <div style={{ 
          textAlign: 'center', 
          marginTop: '3rem', 
          paddingTop: '2rem',
          borderTop: '1px solid rgba(59, 130, 246, 0.1)',
        }}>
          <p style={{ 
            color: '#6b7280', 
            fontSize: '0.95rem',
            maxWidth: '36rem',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            <strong>Important:</strong> This platform connects people for peer support. It&apos;s not a replacement for professional mental health care. If you&apos;re in crisis, please contact emergency services.
          </p>
        </div>
      </div>

      {/* Global styles for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { 
            opacity: 1;
            transform: scale(1);
          }
          50% { 
            opacity: 0.5;
            transform: scale(1.05);
          }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}