import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { uploadBufferToS3 } from "./AWSUtils";
import { Cache } from "./Cache";

export class S3Cache implements Cache {
  constructor(
    private s3: S3Client,
    private bucket: string
  ) {}

  async get(key: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3.send(command);
      if (!response.Body) return null;

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    } catch (error: any) {
      if (
        error.name === "NoSuchKey" ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return null;
      }
      throw error;
    }
  }

  async set(key: string, value: Buffer, contentType: string): Promise<string> {
    const result = await uploadBufferToS3({
      client: this.s3,
      bucket: this.bucket,
      key,
      data: value,
      contentType,
    });
    return result.url;
  }
}
