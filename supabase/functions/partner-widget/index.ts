const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/javascript",
};

const WIDGET_JS = `
(function() {
  var container = document.querySelector('[data-breachpay-scan]');
  if (!container) return;

  var partnerId = container.getAttribute('data-partner-id') || '';
  var theme = container.getAttribute('data-theme') || 'light';

  var style = document.createElement('style');
  style.textContent = \`
    .bp-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 420px; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; background: \${theme === 'dark' ? '#1a1a2e' : '#fff'}; color: \${theme === 'dark' ? '#e2e8f0' : '#1a1a2e'}; }
    .bp-widget h3 { margin: 0 0 8px; font-size: 18px; font-weight: 700; }
    .bp-widget p { margin: 0 0 16px; font-size: 14px; opacity: 0.7; }
    .bp-widget input { width: 100%; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box; }
    .bp-widget button { width: 100%; padding: 12px; border: none; border-radius: 10px; background: #10b981; color: white; font-size: 14px; font-weight: 600; cursor: pointer; }
    .bp-widget button:hover { background: #059669; }
    .bp-widget .bp-footer { margin-top: 12px; text-align: center; font-size: 11px; opacity: 0.5; }
    .bp-widget .bp-footer a { color: inherit; }
  \`;
  document.head.appendChild(style);

  container.innerHTML = \`
    <div class="bp-widget">
      <h3>🔍 Check Your Breach Eligibility</h3>
      <p>See if you're owed money from data breach settlements.</p>
      <input type="email" placeholder="Enter your email" class="bp-email" />
      <button class="bp-btn">Check Now — It's Free</button>
      <div class="bp-footer">Powered by <a href="https://breachpay.com" target="_blank">BreachPay</a></div>
    </div>
  \`;

  var btn = container.querySelector('.bp-btn');
  var input = container.querySelector('.bp-email');
  btn.addEventListener('click', function() {
    var email = input.value.trim();
    if (!email || !email.includes('@')) { alert('Please enter a valid email.'); return; }
    var url = 'https://breachpay.com/signup?ref=' + encodeURIComponent(partnerId) + '&email=' + encodeURIComponent(email);
    window.open(url, '_blank');
  });
})();
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  return new Response(WIDGET_JS, { headers: corsHeaders });
});
