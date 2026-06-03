export async function GET(request, { params }) {
  const graphModuleUrl = process.env.GRAPH_MODULE_URL || 'http://graph_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = params;
  
  try {
    console.log(`[GetDocumentStatus] Calling ${graphModuleUrl}/api/documents/${id}/status/`);
    
    const response = await fetch(`${graphModuleUrl}/api/documents/${id}/status/`, {
      method: 'GET',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`[GetDocumentStatus] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
      return new Response(
        JSON.stringify({ error: `Backend error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[GetDocumentStatus] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

