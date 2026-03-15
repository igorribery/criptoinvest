import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

const s3Client = new S3Client({ region: env.awsRegion });

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type ParsedImage = {
  buffer: Buffer;
  mimeType: string;
  extension: string;
};

function getPublicUrl(key: string) {
  return `https://${env.s3BucketName}.s3.${env.awsRegion}.amazonaws.com/${key}`;
}

function parseImageDataUrl(imageDataUrl: string): ParsedImage {
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Imagem invalida. Envie JPG, PNG ou WEBP.");
  }

  const [, mimeType, base64Payload] = match;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Formato de imagem nao suportado. Use JPG, PNG ou WEBP.");
  }

  const buffer = Buffer.from(base64Payload, "base64");

  if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) {
    throw new Error("A imagem deve ter no maximo 2 MB.");
  }

  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.replace("image/", "");
  return { buffer, mimeType, extension };
}

export async function uploadAvatar(userId: string, imageDataUrl: string) {
  if (!env.s3BucketName) {
    throw new Error("S3_BUCKET_NAME nao configurado no servidor.");
  }

  const parsed = parseImageDataUrl(imageDataUrl);
  const key = `avatars/${userId}/${randomUUID()}.${parsed.extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.s3BucketName,
      Key: key,
      Body: parsed.buffer,
      ContentType: parsed.mimeType,
    }),
  );

  return getPublicUrl(key);
}
