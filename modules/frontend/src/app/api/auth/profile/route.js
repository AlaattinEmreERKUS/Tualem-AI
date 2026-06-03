export async function GET(request) {
  const userModuleUrl = process.env.USER_MODULE_URL || 'http://user_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    const response = await fetch(`${userModuleUrl}/api/auth/profile/`, {
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
    console.error('Get profile API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sunucuya bağlanılamadı.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function PATCH(request) {
  const userModuleUrl = process.env.USER_MODULE_URL || 'http://user_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    const body = await request.formData();
    
    const response = await fetch(`${userModuleUrl}/api/auth/profile/`, {
      method: 'PATCH',
      headers: {
        ...(authHeader && { 'Authorization': authHeader }),
      },
      body: body,
    });

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Update profile API error:', error);
    return new Response(
      JSON.stringify({ error: 'Sunucuya bağlanılamadı.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

