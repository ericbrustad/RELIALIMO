// Environment Configuration
window.ENV = {
  SUPABASE_URL: "https://siumiadylwcrkaqsfwkj.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpdW1pYWR5bHdjcmthcXNmd2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2NjMzMTMsImV4cCI6MjA4MTIzOTMxM30.sSZBsXyOOmIp2eve_SpiUGeIwx3BMoxvY4c7bvE2kKw",
  SUPABASE_UUID: "99d34cd5-a593-4362-9846-db7167276592",
  SUPABASE_EMAIL: "ericbrustad@gmail.com",
  SUPABASE_PASSWORD: "Newhouse2025!",
  SUPABASE_PAT: "sbp_6426f752f2c2c655bb9e4426b627830ed2b8910d",
  PROJECT_REF: "siumiadylwcrkaqsfwkj",

  TWILIO_API_KEY_SECRET: "WzFKnKG0NuNOI8fvZxZBzgcdNwa1Mnfg",
  TWILIO_FROM: "+16123248311",
  TWILIO_AUTH_TOKEN: "b89c8ac3cd3cd1b634c5c48d4ac6646b",
  OPENAI_API_KEY: "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",
  athropic_claude_api: "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",
  gemini_api: "AIzaSyBe-",
  GOOGLE_MAPS_API_KEY: "AIzaSyDVrwMGUaT5_VLgnFauhP7v1EAvIqPJAZA",
  // Use direct Supabase URL unless a local proxy is running
  SUPABASE_PROXY_URL: "https://siumiadylwcrkaqsfwkj.supabase.co"
  };

// When a page is embedded (inside index.html iframes), hide its own header to prevent double headers/flashing
(function hideHeaderWhenEmbedded() {
  if (window.self === window.top) return;

  // Mark document as embedded immediately
  document.documentElement.classList.add('embedded');

  // Inject minimal CSS to hide local headers and remove reserved padding
  const style = document.createElement('style');
  style.id = 'embeddedHeaderHide';
  style.textContent = `
    html.embedded body { padding-top: 0 !important; }
    html.embedded .header, html.embedded header { display: none !important; }
  `;

  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener('DOMContentLoaded', () => document.head && document.head.appendChild(style));
  }
})();
