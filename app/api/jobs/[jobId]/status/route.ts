import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Get backend URL from environment
    const backendUrl = process.env.REFINER_BACKEND_URL;
    if (!backendUrl) {
      return NextResponse.json({ error: 'backend not configured' }, { status: 503 });
    }
    const apiKey = process.env.BACKEND_API_KEY || '';

    // Forward request to backend (provide key via header and query param for flexibility)
    const url = `${backendUrl.replace(/\/$/, '')}/jobs/${jobId}/status${apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : ''}`;

    // Add a 5s timeout to avoid hanging polls
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch job status' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching job status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
