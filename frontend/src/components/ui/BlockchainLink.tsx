'use client';

import { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';

interface BlockchainLinkProps {
  type: 'address' | 'tx';
  value: string;
  truncate?: boolean;
  copyable?: boolean;
  className?: string;
}

const POLYGONSCAN_BASE = 'https://polygonscan.com';

export function BlockchainLink({
  type,
  value,
  truncate = true,
  copyable = true,
  className = '',
}: BlockchainLinkProps) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-muted-foreground">-</span>;
  }

  const url = type === 'address'
    ? `${POLYGONSCAN_BASE}/address/${value}`
    : `${POLYGONSCAN_BASE}/tx/${value}`;

  const displayValue = truncate
    ? `${value.slice(0, 8)}...${value.slice(-6)}`
    : value;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copy failed - gracefully ignore
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm text-primary hover:underline inline-flex items-center gap-1"
        title={value}
      >
        {displayValue}
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
      </a>
      {copyable && (
        <button
          onClick={handleCopy}
          className="p-0.5 rounded hover:bg-muted transition-colors"
          title={copied ? 'Copied!' : 'Copy to clipboard'}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          )}
        </button>
      )}
    </span>
  );
}

// Convenience components
export function AddressLink(props: Omit<BlockchainLinkProps, 'type'>) {
  return <BlockchainLink {...props} type="address" />;
}

export function TxLink(props: Omit<BlockchainLinkProps, 'type'>) {
  return <BlockchainLink {...props} type="tx" />;
}
