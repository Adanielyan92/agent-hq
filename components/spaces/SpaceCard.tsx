'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import type { Space } from '@/lib/db/schema';

export function SpaceCard({ space }: { space: Space }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="font-mono">{space.name}</CardTitle>
            <CardDescription className="font-mono text-xs mt-1">{space.repo_full_name}</CardDescription>
          </div>
          {space.share_enabled && <Badge variant="secondary">Shared</Badge>}
        </div>
      </CardHeader>
      <CardFooter className="gap-2">
        <Link href={`/spaces/${space.id}`} className={buttonVariants({ size: 'sm' })}>Open Office</Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await fetch(`/api/spaces/${space.id}`, { method: 'DELETE' });
            window.location.reload();
          }}
        >
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
