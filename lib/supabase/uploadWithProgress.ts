// The standard supabase-js storage client uses fetch() under the hood, which
// has no upload progress event at all. XMLHttpRequest does (xhr.upload.onprogress),
// so this bypasses the SDK for just the upload call to get a real percentage,
// while still hitting the same Storage REST endpoint the SDK itself uses.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hiruufvoyigrcdohqjkm.supabase.co';

export function uploadWithProgress(
  bucket: string,
  path: string,
  file: Blob,
  accessToken: string,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`;

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('Content-Type', contentType || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || 'unknown error'}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));

    xhr.send(file);
  });
}