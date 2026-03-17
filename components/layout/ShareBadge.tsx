'use client';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function ShareBadge() {
  return <Badge variant="secondary" className="font-mono text-xs">View only</Badge>;
}

export function ShareToggle({ spaceId, shareEnabled, shareToken }: {
  spaceId: string; shareEnabled: boolean; shareToken: string;
}) {
  const [enabled, setEnabled] = useState(shareEnabled);
  const [copying, setCopying] = useState(false);

  async function toggle() {
    const res = await fetch(`/api/spaces/${spaceId}/share`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share_enabled: !enabled }),
    });
    const data = await res.json();
    setEnabled(data.share_enabled);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/s/${shareToken}`);
    setCopying(true);
    setTimeout(() => setCopying(false), 1500);
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={toggle} className="font-mono text-xs">
        {enabled ? 'Sharing On' : 'Share'}
      </Button>
      {enabled && (
        <Button variant="ghost" size="sm" onClick={copyLink} className="font-mono text-xs">
          {copying ? 'Copied!' : 'Copy Link ↗'}
        </Button>
      )}
    </div>
  );
}
