// components/UserLink.tsx
'use client';
import Link from 'next/link';
import { User } from 'lucide-react';

interface UserLinkProps {
  userId: string;
  username: string;
  showIcon?: boolean;
  className?: string;
  isAnonymous?: boolean;
}

const UserLink = ({ 
  userId, 
  username, 
  showIcon = false,
  className = '',
  isAnonymous = false
}: UserLinkProps) => {
  if (isAnonymous) {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500">
        {username}
        {showIcon && <User size={12} />}
      </span>
    );
  }

  return (
    <Link 
      href={`/profile/${userId}`} 
      className={`hover:underline ${className}`}
      style={{ color: '#b45309', fontWeight: 500 }}
      aria-label={`View ${username}'s profile`}
    >
      {showIcon && <User size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />}
      {username}
    </Link>
  );
};

export default UserLink;