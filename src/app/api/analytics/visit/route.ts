import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const visitSchema = z.object({
  sessionId: z.string().uuid(),
  device: z.enum(['mobile', 'desktop']),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = visitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid visit data' }, { status: 400 });
  }

  await prisma.analyticsVisit.upsert({
    where: { sessionId: parsed.data.sessionId },
    update: {},
    create: parsed.data,
  });

  return new NextResponse(null, { status: 204 });
}
