import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDevSession } from '@/lib/dev-session-store';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Get current user
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const devSession = getDevSession(id);
  if (devSession) {
    return NextResponse.json({
      id: devSession.id,
      imageUrl: devSession.imageUrl,
      query: devSession.query,
      country: devSession.country,
      status: devSession.status,
      createdAt: devSession.createdAt,
      results: devSession.results
    });
  }

  let session = null;
  let retries = 3;
  
  while (retries > 0) {
    try {
      session = await prisma.searchSession.findUnique({
        where: { id },
        include: { results: true }
      });
      break; // Success
    } catch (e) {
      retries--;
      if (retries === 0) throw e;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
    }
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 });
  }

  // Privacy check: If session belongs to a user, only that user can view it
  if (session.userId && session.userId !== user?.id) {
    return NextResponse.json({ error: 'Unauthorized access to this search.' }, { status: 403 });
  }

  return NextResponse.json({
    id: session.id,
    imageUrl: session.imageUrl,
    query: session.query,
    country: session.country,
    status: session.status,
    createdAt: session.createdAt,
    results: session.results
  });
}
