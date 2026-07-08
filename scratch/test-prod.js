// Uses global fetch

async function testProd() {
  console.log("Testing room.getmaterio.app token proxy endpoint...");
  
  // Try sending a dummy request to check how it responds
  try {
    const res = await fetch('https://room.getmaterio.app/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: 'dummy_code',
        client_id: 'dummy_client'
      })
    });
    
    console.log("Response Status:", res.status);
    console.log("Response Headers:", Object.fromEntries(res.headers.entries()));
    const text = await res.text();
    console.log("Response Body:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

testProd();
