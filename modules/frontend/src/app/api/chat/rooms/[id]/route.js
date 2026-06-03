export async function GET(request, { params }) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = await params;
  
  try {
    console.log(`[GetRoom] Calling ${chatModuleUrl}/api/chat/rooms/${id}/`);
    
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/${id}/`, {
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
      console.error(`[GetRoom] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[GetRoom] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function PATCH(request, { params }) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = await params;
  
  try {
    const body = await request.json();
    
    console.log(`[UpdateRoom] Calling ${chatModuleUrl}/api/chat/rooms/${id}/`);
    
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`[UpdateRoom] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[UpdateRoom] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(request, { params }) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = await params;
  
  try {
    console.log(`[DeleteRoom] Calling ${chatModuleUrl}/api/chat/rooms/${id}/`);
    
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/${id}/`, {
      method: 'DELETE',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
    });

    const text = await response.text();
    console.log(`[DeleteRoom] status=${response.status} body=${text.substring(0, 300)}`);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`[DeleteRoom] non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[DeleteRoom] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

