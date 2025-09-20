import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase-admin/firestore';

export const MEDIA_PIPELINE_VERSION = 'v1';

export type MediaType = 'audio' | 'image';
export type MediaStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface MediaAssetDoc {
  assetId: string;
  userId: string;
  entryId: string;
  type: MediaType;
  mime: string;
  status: MediaStatus;
  transcript?: string;
  labels?: string[];
  caption?: string;
  durationSec?: number;
  sizeBytes: number;
  error?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  version: string; // media pipeline version
}

export interface UploadRequestInput {
  userId: string;
  entryId: string;
  type: MediaType;
  mime: string;
  sizeBytes?: number; // optional hint from client
}

export interface UploadGrant {
  assetId: string;
  uploadUrl: string; // placeholder for now
  storagePath: string;
  headers: Record<string,string>;
  expiresAt: string; // ISO
  maxBytes: number;
}

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
export const MAX_AUDIO_SECONDS = 120; // soft cap (enforced later)

export function generateAssetId() { return uuidv4(); }

export function maxBytesForType(type: MediaType) {
  return type === 'audio' ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
}

export function validateMime(type: MediaType, mime: string): boolean {
  if (type === 'audio') return /^audio\//.test(mime);
  if (type === 'image') return /^(image\/png|image\/jpeg)$/.test(mime);
  return false;
}

export function nowTs() { return Timestamp.now(); }
