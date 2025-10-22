import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'jobId query parameter is required' }), { status: 400 });
    }

    const jobStatus = await kv.get(jobId);

    if (!jobStatus) {
      // If the job isn't found, it might still be in the process of being created,
      // so we'll report it as 'pending'.
      return new Response(JSON.stringify({ status: 'pending', jobId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(jobStatus), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in /api/verificar-estado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor al verificar el estado';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
