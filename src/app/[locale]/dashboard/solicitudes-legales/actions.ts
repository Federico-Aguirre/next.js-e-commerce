'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getDashboardAdmin } from '../data';

const statusSchema = z.enum(['RECEIVED', 'IN_REVIEW', 'COMPLETED']);

export async function updateConsumerRequestStatus(formData: FormData) {
  const admin = await getDashboardAdmin();
  if (!admin) throw new Error('FORBIDDEN');

  const id = String(formData.get('id') ?? '');
  const locale = formData.get('locale') === 'es' ? 'es' : 'en';
  const parsedStatus = statusSchema.safeParse(formData.get('status'));
  if (!id || !parsedStatus.success) throw new Error('Invalid consumer request update.');

  await prisma.consumerRequest.update({
    where: { id },
    data: { status: parsedStatus.data },
  });

  revalidatePath((locale === 'en' ? '' : '/' + locale) + '/dashboard/solicitudes-legales');
}
