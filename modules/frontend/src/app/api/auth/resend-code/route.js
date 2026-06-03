export async function POST(request) {
  const userModuleUrl = process.env.USER_MODULE_URL || 'http://user_module.railway.internal:8080';
  
  try {
    const body = await request.json();
    
    console.log(`[ResendCode] Calling ${userModuleUrl}/api/auth/resend-code/`);
    
    const response = await fetch(`${userModuleUrl}/api/auth/resend-code/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`[ResendCode] Backend returned non-JSON (status ${response.status}):`, text.substring(0, 500));
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
    console.error('[ResendCode] API error:', error.message);
    return new Response(
      JSON.stringify({ error: `Sunucuya bağlanılamadı: ${error.message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

