import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../generated/prisma/client.js';

config({ path: resolve(process.cwd(), '.env') });
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production' || !/localhost|127\.0\.0\.1/.test(url))
  throw new Error('Sample documents are restricted to a local non-production database');

function escapePdfText(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function makePdf(title: string, subtitle: string) {
  const stream = `BT\n/F1 22 Tf\n72 700 Td\n(${escapePdfText(title)}) Tj\n0 -36 Td\n/F1 12 Tf\n(${escapePdfText(subtitle)}) Tj\n0 -28 Td\n(Sample document for local platform preview.) Tj\nET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${offset.toString().padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

try {
  const user = await prisma.user.findFirst({
    where: { role: 'CLIENT', status: 'ACTIVE', client: { isNot: null } },
    orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
    include: { client: true },
  });
  if (!user?.client) throw new Error('No active local client account was found');

  const storageRoot = resolve(
    process.env.CREDIT_REPORT_STORAGE_DIR ??
      fileURLToPath(new URL('../../.data/', import.meta.url)),
  );
  const storageDirectory = resolve(storageRoot, 'credit-reports', user.client.id);
  await mkdir(storageDirectory, { recursive: true });

  const samples = [
    {
      key: 'sample-current-credit-report.pdf',
      name: 'Tri-Bureau Credit Report — August 2026.pdf',
      title: 'Tri-Bureau Credit Report',
      subtitle: 'Report date: August 20, 2026',
      daysAgo: 5,
      superseded: false,
    },
    {
      key: 'sample-spring-credit-report.pdf',
      name: 'Credit Report — May 2026.pdf',
      title: 'Credit Report History',
      subtitle: 'Report date: May 12, 2026',
      daysAgo: 105,
      superseded: true,
    },
    {
      key: 'sample-winter-credit-report.pdf',
      name: 'Credit Report — February 2026.pdf',
      title: 'Credit Report History',
      subtitle: 'Report date: February 8, 2026',
      daysAgo: 198,
      superseded: true,
    },
    {
      key: 'sample-fall-credit-report.pdf',
      name: 'Credit Report — November 2025.pdf',
      title: 'Credit Report History',
      subtitle: 'Report date: November 10, 2025',
      daysAgo: 288,
      superseded: true,
    },
  ];

  for (const sample of samples) {
    const storageKey = `credit-reports/${user.client.id}/${sample.key}`;
    const content = makePdf(sample.title, sample.subtitle);
    await writeFile(resolve(storageRoot, storageKey), content);
    const uploadedAt = new Date(Date.now() - sample.daysAgo * 86_400_000);
    await prisma.creditReportDocument.upsert({
      where: { storageKey },
      create: {
        id: randomUUID(),
        storageKey,
        originalFileName: sample.name,
        mimeType: 'application/pdf',
        sizeBytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex'),
        provider: 'Sample data',
        uploadedByUserId: user.id,
        uploadedAt,
        supersededAt: sample.superseded ? new Date(uploadedAt.getTime() + 60 * 86_400_000) : null,
      },
      update: {
        originalFileName: sample.name,
        mimeType: 'application/pdf',
        sizeBytes: content.length,
        sha256: createHash('sha256').update(content).digest('hex'),
        provider: 'Sample data',
        uploadedByUserId: user.id,
        uploadedAt,
        supersededAt: sample.superseded ? new Date(uploadedAt.getTime() + 60 * 86_400_000) : null,
      },
    });
  }

  console.info(`Added ${samples.length} sample documents for ${user.email}`);
} finally {
  await prisma.$disconnect();
}
