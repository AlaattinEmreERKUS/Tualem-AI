export async function GET(request, { params }) {
  const graphModuleUrl = process.env.GRAPH_MODULE_URL || 'http://graph_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = params;
  
  try {
    const response = await fetch(`${graphModuleUrl}/api/documents/${id}/status/`, {
      method: 'GET',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
    });

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get document status API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sunucuya bağlanılamadı.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

