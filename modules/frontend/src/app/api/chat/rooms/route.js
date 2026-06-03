export async function GET(request) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    console.log(`[GetRooms] Calling ${chatModuleUrl}/api/chat/rooms/`);
    
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/`, {
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
      console.error(`[GetRooms] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[GetRooms] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function POST(request) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    const body = await request.json();
    
    console.log(`[CreateRoom] Calling ${chatModuleUrl}/api/chat/rooms/`);
    
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/`, {
      method: 'POST',
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
      console.error(`[CreateRoom] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[CreateRoom] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

