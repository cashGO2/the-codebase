
import {createRequire as ___nfyCreateRequire} from "module";
import {fileURLToPath as ___nfyFileURLToPath} from "url";
import {dirname as ___nfyPathDirname} from "path";
let __filename=___nfyFileURLToPath(import.meta.url);
let __dirname=___nfyPathDirname(___nfyFileURLToPath(import.meta.url));
let require=___nfyCreateRequire(import.meta.url);


// api/v1/invites-test/invites-test.mjs
var invites_test_default = async (event, context) => {
  console.log("Invites test function called");
  console.log("Event method:", event.httpMethod);
  console.log("Event path:", event.path);
  console.log("Event headers:", JSON.stringify(event.headers));
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      console.log("Event body:", JSON.stringify(body));
    } catch (e) {
      console.log("Error parsing body:", e);
      console.log("Raw body:", event.body);
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: "Invites test function",
      method: event.httpMethod,
      path: event.path,
      body: event.body ? JSON.parse(event.body) : null,
      headers: event.headers
    })
  };
};
export {
  invites_test_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiYXBpL3YxL2ludml0ZXMtdGVzdC9pbnZpdGVzLXRlc3QubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvLyBEb2NzIG9uIGV2ZW50IGFuZCBjb250ZXh0IGh0dHBzOi8vZG9jcy5uZXRsaWZ5LmNvbS9mdW5jdGlvbnMvYnVpbGQvI2NvZGUteW91ci1mdW5jdGlvbi0yXG5leHBvcnQgZGVmYXVsdCBhc3luYyAoZXZlbnQsIGNvbnRleHQpID0+IHtcbiAgY29uc29sZS5sb2coJ0ludml0ZXMgdGVzdCBmdW5jdGlvbiBjYWxsZWQnKTtcbiAgY29uc29sZS5sb2coJ0V2ZW50IG1ldGhvZDonLCBldmVudC5odHRwTWV0aG9kKTtcbiAgY29uc29sZS5sb2coJ0V2ZW50IHBhdGg6JywgZXZlbnQucGF0aCk7XG4gIGNvbnNvbGUubG9nKCdFdmVudCBoZWFkZXJzOicsIEpTT04uc3RyaW5naWZ5KGV2ZW50LmhlYWRlcnMpKTtcbiAgXG4gIGlmIChldmVudC5ib2R5KSB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGJvZHkgPSBKU09OLnBhcnNlKGV2ZW50LmJvZHkpO1xuICAgICAgY29uc29sZS5sb2coJ0V2ZW50IGJvZHk6JywgSlNPTi5zdHJpbmdpZnkoYm9keSkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdFcnJvciBwYXJzaW5nIGJvZHk6JywgZSk7XG4gICAgICBjb25zb2xlLmxvZygnUmF3IGJvZHk6JywgZXZlbnQuYm9keSk7XG4gICAgfVxuICB9XG4gIFxuICByZXR1cm4ge1xuICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IFxuICAgICAgbWVzc2FnZTogJ0ludml0ZXMgdGVzdCBmdW5jdGlvbicsXG4gICAgICBtZXRob2Q6IGV2ZW50Lmh0dHBNZXRob2QsXG4gICAgICBwYXRoOiBldmVudC5wYXRoLFxuICAgICAgYm9keTogZXZlbnQuYm9keSA/IEpTT04ucGFyc2UoZXZlbnQuYm9keSkgOiBudWxsLFxuICAgICAgaGVhZGVyczogZXZlbnQuaGVhZGVyc1xuICAgIH0pXG4gIH07XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUNBLElBQU8sdUJBQVEsT0FBTyxPQUFPLFlBQVk7QUFDdkMsVUFBUSxJQUFJLDhCQUE4QjtBQUMxQyxVQUFRLElBQUksaUJBQWlCLE1BQU0sVUFBVTtBQUM3QyxVQUFRLElBQUksZUFBZSxNQUFNLElBQUk7QUFDckMsVUFBUSxJQUFJLGtCQUFrQixLQUFLLFVBQVUsTUFBTSxPQUFPLENBQUM7QUFFM0QsTUFBSSxNQUFNLE1BQU07QUFDZCxRQUFJO0FBQ0YsWUFBTSxPQUFPLEtBQUssTUFBTSxNQUFNLElBQUk7QUFDbEMsY0FBUSxJQUFJLGVBQWUsS0FBSyxVQUFVLElBQUksQ0FBQztBQUFBLElBQ2pELFNBQVMsR0FBRztBQUNWLGNBQVEsSUFBSSx1QkFBdUIsQ0FBQztBQUNwQyxjQUFRLElBQUksYUFBYSxNQUFNLElBQUk7QUFBQSxJQUNyQztBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQUEsSUFDTCxZQUFZO0FBQUEsSUFDWixNQUFNLEtBQUssVUFBVTtBQUFBLE1BQ25CLFNBQVM7QUFBQSxNQUNULFFBQVEsTUFBTTtBQUFBLE1BQ2QsTUFBTSxNQUFNO0FBQUEsTUFDWixNQUFNLE1BQU0sT0FBTyxLQUFLLE1BQU0sTUFBTSxJQUFJLElBQUk7QUFBQSxNQUM1QyxTQUFTLE1BQU07QUFBQSxJQUNqQixDQUFDO0FBQUEsRUFDSDtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
