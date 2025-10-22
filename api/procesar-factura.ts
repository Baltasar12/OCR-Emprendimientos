import { kv } from '@vercel/kv';

// Required for Vercel Edge Functions
export const config = {
  runtime: 'edge',
};

// Helper to encode ArrayBuffer to Base64 in an edge environment
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Default export for Vercel Serverless Function
export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se recibió ningún archivo' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    // 1. Generate a unique job ID
    const jobId = crypto.randomUUID();

    // 2. Convert file to base64 to pass it in a JSON body to the worker
    const fileBuffer = await file.arrayBuffer();
    const fileData = arrayBufferToBase64(fileBuffer);
    const mimeType = file.type;

    // 3. Save initial state in Vercel KV
    await kv.set(jobId, { status: 'pending', filename: file.name, jobId });

    // 4. Invoke the worker in the background (fire-and-forget)
    const host = request.headers.get('host');
    const protocol = host?.startsWith('localhost') ? 'http' : 'https';
    const workerUrl = `${protocol}://${host}/api/realizar-ocr`;
    
    // We don't await this fetch call. This is the key to the async pattern.
    fetch(workerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // Pass auth headers if needed in a real application
      },
      body: JSON.stringify({
        jobId,
        fileData,
        mimeType
      }),
    });

    // 5. Respond immediately to the client with the job ID.
    // The 202 Accepted status code is perfect for this "job started" scenario.
    return new Response(JSON.stringify({ jobId }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in /api/procesar-factura:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor al iniciar el procesamiento';
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
