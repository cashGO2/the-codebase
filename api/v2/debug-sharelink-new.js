const { 
  supabase, 
  corsHeaders
} = require('./utils');
const cors = require('./cors');

module.exports = async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin;
  
  console.log('Debug sharelink handler - Received request');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return cors(req, res);
  }

  try {
    // Test table existence
    const { error: testError } = await supabase
      .from('sharelinks')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('Error testing sharelinks table:', testError);
      return res.status(500).json({
        error: 'Sharelinks table may not exist',
        details: testError.message,
        hint: 'Try running the migrations endpoint'
      });
    }
    
    // Create a test sharelink if needed
    if (req.method === 'POST') {
      try {
        const { inviteCode, customHeading } = req.body;
        
        // Test creating a sharelink
        const { data: existingInvite, error: inviteError } = await supabase
          .from('invites')
          .select('id, code')
          .eq('code', inviteCode)
          .single();

        if (inviteError) {
          return res.status(404).json({
            error: 'Invite not found',
            details: inviteError.message
          });
        }

        // Try to create the sharelink directly
        const { data: sharelink, error: createError } = await supabase
          .from('sharelinks')
          .upsert({
            invite_code: inviteCode,
            custom_heading: customHeading || null,
            created_by: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'invite_code'
          })
          .select()
          .single();

        if (createError) {
          return res.status(500).json({
            error: 'Failed to create test sharelink',
            details: createError.message
          });
        }

        // Determine the base URL based on the environment
        const isLocalhost = origin && (origin.includes('localhost') || origin.includes('127.0.0.1'));
        const baseUrl = isLocalhost ? origin : 'https://materioa.netlify.app';

        return res.status(200).json({
          message: 'Debug sharelink created successfully',
          sharelink: {
            inviteCode: sharelink.invite_code,
            customHeading: sharelink.custom_heading,
            url: `${baseUrl}/invites/${sharelink.invite_code}`,
            createdAt: sharelink.created_at,
            updatedAt: sharelink.updated_at
          }
        });
      } catch (parseError) {
        console.error('Error parsing request body:', parseError);
        return res.status(400).json({
          error: 'Invalid request body',
          details: parseError.message
        });
      }
    }

    // Default GET response - return a debug page
    const debugPage = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sharelink Debug Tool</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #4a5568;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 10px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        input, textarea {
          width: 100%;
          padding: 8px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
        }
        button {
          background-color: #4299e1;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
        }
        button:hover {
          background-color: #3182ce;
        }
        .result {
          margin-top: 20px;
          padding: 15px;
          background-color: #f7fafc;
          border-radius: 4px;
          border-left: 4px solid #4299e1;
        }
        .error {
          color: #e53e3e;
          border-left-color: #e53e3e;
        }
      </style>
    </head>
    <body>
      <h1>Sharelink Debug Tool</h1>
      <div class="form-group">
        <label for="inviteCode">Invite Code</label>
        <input type="text" id="inviteCode" placeholder="Enter invite code">
      </div>
      <div class="form-group">
        <label for="customHeading">Custom Heading</label>
        <input type="text" id="customHeading" placeholder="Enter custom heading (optional)">
      </div>
      <div class="form-group">
        <label for="inviteUrl">Generated URL</label>
        <input type="text" id="inviteUrl" readonly placeholder="URL will appear here">
      </div>
      <button id="testBtn">Test Sharelink Creation</button>
      <div id="result" class="result" style="display:none;"></div>

      <script>
        document.getElementById('testBtn').addEventListener('click', async function() {
          const inviteCode = document.getElementById('inviteCode').value.trim();
          const customHeading = document.getElementById('customHeading').value.trim();
          const resultDiv = document.getElementById('result');
          const inviteUrlInput = document.getElementById('inviteUrl');
          
          if (!inviteCode) {
            resultDiv.textContent = 'Please enter an invite code';
            resultDiv.style.display = 'block';
            resultDiv.className = 'result error';
            return;
          }
          
          try {
            resultDiv.textContent = 'Testing...';
            resultDiv.style.display = 'block';
            resultDiv.className = 'result';
            
            const response = await fetch('/api/v2/debug-sharelink-new', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                inviteCode,
                customHeading: customHeading || null
              })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              resultDiv.textContent = 'Success: ' + data.message;
              resultDiv.className = 'result';
              inviteUrlInput.value = data.sharelink.url;
            } else {
              resultDiv.textContent = 'Error: ' + (data.error || 'Unknown error');
              resultDiv.className = 'result error';
              if (data.details) {
                resultDiv.textContent += '\\n\\nDetails: ' + data.details;
              }
            }
          } catch (error) {
            resultDiv.textContent = 'Error: ' + error.message;
            resultDiv.className = 'result error';
          }
        });
      </script>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(debugPage);

  } catch (error) {
    console.error('Debug sharelink error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};