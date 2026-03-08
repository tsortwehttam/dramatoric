import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { basename } from "path";

type PutOpts = {
  client: S3Client;
  bucket: string;
  key?: string;
  cacheControl?: string;
  contentType?: string;
};

export const s3PublicUrl = ({
  region,
  bucket,
  key,
}: {
  region: string;
  bucket: string;
  key: string;
}) => {
  const host =
    region === "us-east-1" ? "s3.amazonaws.com" : `s3.${region}.amazonaws.com`;
  const k = key.split("/").map(encodeURIComponent).join("/");
  return `https://${bucket}.${host}/${k}`;
};

const resolveKey = (key: string | undefined, filePath: string) => {
  if (!key || key === "/") return basename(filePath);
  if (key.endsWith("/")) return `${key}${basename(filePath)}`;
  return key.replace(/^\/+/, "");
};

export const uploadBufferToS3 = async ({
  client,
  bucket,
  key,
  cacheControl = "public, max-age=31536000, immutable",
  contentType = "application/octet-stream",
  data,
  fallbackFileName = "file.bin",
}: PutOpts & {
  data: Buffer | Uint8Array | string;
  fallbackFileName?: string;
}) => {
  const Key = resolveKey(key, fallbackFileName);
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key,
    Body: data,
    ACL: "public-read",
    ContentType: contentType,
    CacheControl: cacheControl,
  });
  const res = await client.send(cmd);
  const region = await client.config.region();
  const url = s3PublicUrl({ region, bucket, key: Key });
  return {
    key: Key,
    url,
    etag: res.ETag ?? null,
  };
};

export async function s3ObjectExists(
  client: S3Client,
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error: any) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}
