/**
 * Loading Spinner Component
 * 
 * Reusable loading indicator with Farther branding.
 */

import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...', size = 'medium' }) {
  const sizeClasses = {
    small: 'w-6 h-6',
    medium: 'w-12 h-12',
    large: 'w-16 h-16',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-[#1a7a82] mb-4`} />
      <p className="text-[#FCFDFC] opacity-80 text-center">{message}</p>
    </div>
  );
}
