export async function GET(request) {
  const graphModuleUrl = process.env.GRAPH_MODULE_URL || 'http://graph_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    console.log(`[GetDocuments] Calling ${graphModuleUrl}/api/documents/`);
    
    const response = await fetch(`${graphModuleUrl}/api/documents/`, {
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
      console.error(`[GetDocuments] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[GetDocuments] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request) {
  const graphModuleUrl = process.env.GRAPH_MODULE_URL || 'http://graph_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    const body = await request.formData();
    
    console.log(`[CreateDocument] Calling ${graphModuleUrl}/api/documents/`);
    
    const response = await fetch(`${graphModuleUrl}/api/documents/`, {
      method: 'POST',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: body,
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`[CreateDocument] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[CreateDocument] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

