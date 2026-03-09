// Vercel Serverless Function - CORS Proxy for GovMap API
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Forward the request to GovMap API
    const govmapResponse = await fetch('https://www.govmap.gov.il/api/layers-catalog/entitiesByPoint', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhereMiklat/1.0'
      },
      body: JSON.stringify(req.body)
    });

    if (!govmapResponse.ok) {
      throw new Error(`GovMap API error: ${govmapResponse.status}`);
    }

    const data = await govmapResponse.json();

    // Return the data with CORS headers
    res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch shelter data',
      message: error.message
    });
  }
}