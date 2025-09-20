import { defineString } from 'firebase-functions/params';

// Centralized function parameters
// MEDIA_BUCKET: Name of the dedicated media bucket (no gs:// prefix)
export const MEDIA_BUCKET = defineString('MEDIA_BUCKET', {
  default: 'mindscribe-472408-media'
});
