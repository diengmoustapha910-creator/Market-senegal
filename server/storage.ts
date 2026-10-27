import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface UploadedFileResult {
  url: string;
  filename: string;
  provider: 'local' | 's3';
}

export interface StorageStatus {
  provider: 'local' | 's3';
  configured: boolean;
  isProduction: boolean;
  error?: string;
  bucket?: string;
  endpoint?: string;
}

export function checkStorageConfig(): StorageStatus {
  const isProduction = process.env.NODE_ENV === 'production';
  const provider = (process.env.STORAGE_PROVIDER || (isProduction ? 's3' : 'local')).toLowerCase() as 'local' | 's3';

  if (isProduction && provider === 'local') {
    return {
      provider: 'local',
      configured: false,
      isProduction: true,
      error: 'Le stockage local (STORAGE_PROVIDER=local) est interdit en production sur Cloud Run car le conteneur est éphémère. Configurez STORAGE_PROVIDER=s3 avec un bucket Cloudflare R2, Google Cloud Storage ou AWS S3.'
    };
  }

  if (provider === 's3') {
    const bucket = process.env.S3_BUCKET_NAME;
    const accessKey = process.env.S3_ACCESS_KEY_ID;
    const secretKey = process.env.S3_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT;

    const missing: string[] = [];
    if (!bucket) missing.push('S3_BUCKET_NAME');
    if (!accessKey) missing.push('S3_ACCESS_KEY_ID');
    if (!secretKey) missing.push('S3_SECRET_ACCESS_KEY');
    if (!endpoint) missing.push('S3_ENDPOINT');

    if (missing.length > 0) {
      return {
        provider: 's3',
        configured: false,
        isProduction,
        error: `Configuration S3 incomplète. Variables requises manquantes : ${missing.join(', ')}.`
      };
    }

    return {
      provider: 's3',
      configured: true,
      isProduction,
      bucket,
      endpoint
    };
  }

  return {
    provider: 'local',
    configured: true,
    isProduction: false
  };
}

let cachedS3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (cachedS3Client) return cachedS3Client;

  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;

  cachedS3Client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    // Force path style for Cloudflare R2 / MinIO / GCS compatibility
    forcePathStyle: true
  });

  return cachedS3Client;
}

export async function storeFile(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<UploadedFileResult> {
  const status = checkStorageConfig();

  if (!status.configured) {
    throw new Error(status.error || 'Erreur de configuration du stockage de fichiers.');
  }

  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `market_sn_${Date.now()}_${cleanBase || 'upload'}${ext}`;

  if (status.provider === 's3') {
    const s3 = getS3Client();
    const bucket = process.env.S3_BUCKET_NAME!;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `uploads/${filename}`,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );

    // Compute public URL
    let publicUrl: string;
    if (process.env.S3_PUBLIC_DOMAIN) {
      publicUrl = `${process.env.S3_PUBLIC_DOMAIN.replace(/\/+$/, '')}/uploads/${filename}`;
    } else {
      const endpoint = process.env.S3_ENDPOINT!.replace(/\/+$/, '');
      publicUrl = `${endpoint}/${bucket}/uploads/${filename}`;
    }

    return {
      url: publicUrl,
      filename,
      provider: 's3'
    };
  }

  // Local storage (Development only)
  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const targetPath = path.join(uploadsDir, filename);
  fs.writeFileSync(targetPath, file.buffer);

  return {
    url: `/uploads/${filename}`,
    filename,
    provider: 'local'
  };
}
