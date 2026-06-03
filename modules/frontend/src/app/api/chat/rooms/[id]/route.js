export async function GET(request, { params }) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = params;
  
  try {
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/${id}/`, {
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
    console.error('Get chat room API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sunucuya bağlanılamadı.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function PATCH(request, { params }) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = params;
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/${id}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update chat room API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sunucuya bağlanılamadı.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function DELETE(request, { params }) {
  const chatModuleUrl = process.env.CHAT_MODULE_URL || 'http://chat_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  const { id } = params;
  
  try {
    const response = await fetch(`${chatModuleUrl}/api/chat/rooms/${id}/`, {
      method: 'DELETE',
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
    console.error('Delete chat room API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sunucuya bağlanılamadı.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

