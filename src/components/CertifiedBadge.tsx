import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface CertifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showText?: boolean;
}

export const CertifiedBadge: React.FC<CertifiedBadgeProps> = ({
  size = 'sm',
  className = '',
  showText = true
}) => {
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const textSizes = {
    sm: 'text-[11px]',
    md: 'text-xs',
    lg: 'text-sm'
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold text-blue-700 bg-blue-50/90 border border-blue-200/80 rounded-md px-1.5 py-0.5 tracking-tight ${textSizes[size]} ${className}`}
      title="Boutique vérifiée et certifiée officiellement par MARKET SÉNÉGAL"
    >
      <ShieldCheck className={`${iconSizes[size]} text-blue-600 shrink-0 fill-blue-100`} />
      {showText && <span>Boutique certifiée</span>}
    </span>
  );
};
