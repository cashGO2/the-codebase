// Docs on event and context https://docs.netlify.com/functions/build/#code-your-function-2
export default async function (req, res) {
  console.log('Invites test function called');
  console.log('Event method:', req.method);
  console.log('Event path:', req.url);
  console.log('Event headers:', JSON.stringify(req.headers));
  
  if (req.body) {
    try {
      const body = req.body;
      console.log('Event body:', JSON.stringify(body));
    } catch (e) {
      console.log('Error parsing body:', e);
      console.log('Raw body:', req.body);
    }
  }
  
  return res.status(200).json({ 
    message: 'Invites test function',
    method: req.method,
    path: req.url,
    body: req.body || null,
    headers: req.headers
  });
};
