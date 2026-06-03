export async function POST(request) {
  const userModuleUrl = process.env.USER_MODULE_URL || 'http://user_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    const body = await request.json();
    
    const response = await fetch(`${userModuleUrl}/api/auth/logout/`, {
      method: 'POST',
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
    console.error('Logout API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sunucuya bağlanılamadı.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

