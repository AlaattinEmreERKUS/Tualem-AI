export async function GET(request) {
  const userModuleUrl = process.env.USER_MODULE_URL || 'http://user_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    console.log(`[GetProfile] Calling ${userModuleUrl}/api/auth/profile/`);
    
    const response = await fetch(`${userModuleUrl}/api/auth/profile/`, {
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
      console.error(`[GetProfile] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[GetProfile] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function PATCH(request) {
  const userModuleUrl = process.env.USER_MODULE_URL || 'http://user_module.railway.internal:8080';
  const authHeader = request.headers.get('authorization');
  
  try {
    const body = await request.formData();
    
    console.log(`[UpdateProfile] Calling ${userModuleUrl}/api/auth/profile/`);
    
    const response = await fetch(`${userModuleUrl}/api/auth/profile/`, {
      method: 'PATCH',
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
      console.error(`[UpdateProfile] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[UpdateProfile] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

