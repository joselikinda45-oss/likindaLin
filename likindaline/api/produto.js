/* Função da Vercel: serve /p/<id> com metadados Open Graph do produto (necessário para a
   pré-visualização no Facebook, que não executa JavaScript). Pessoas reais são
   reencaminhadas para produto.html?id=<id>. Só lê dados públicos (chave "anon"). */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const kz = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " Kz";

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || "").slice(0, 80);
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const base = (process.env.SITE_URL || `https://${host}`).replace(/\/+$/, "");
  const {SUPABASE_URL: url, SUPABASE_ANON_KEY: key} = process.env;

  let p = null;
  try {
    if (id && url && key) {
      const r = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=id,name,price,description,image&limit=1`, {headers: {apikey: key}});
      if (r.ok) p = (await r.json())[0] || null;
    }
  } catch (_) { /* devolve a página genérica */ }

  const dest = `/produto.html?id=${encodeURIComponent(id)}`;
  const title = p ? `${p.name} — ${kz(p.price)} | LikindaLine` : "LikindaLine";
  const desc = p ? String(p.description || "").replace(/\s+/g, " ").slice(0, 200) || "Vê fotografias e preço deste produto." : "Produtos em kwanzas com encomenda pelo WhatsApp.";
  const image = p && /^https:\/\//i.test(p.image || "") ? p.image : `${base}/img/og-likindaline.png`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  res.status(p ? 200 : 404).send(`<!DOCTYPE html>
<html lang="pt-AO"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="product"><meta property="og:site_name" content="LikindaLine"><meta property="og:locale" content="pt_AO">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(`${base}/p/${encodeURIComponent(id)}`)}"><meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<script>location.replace(${JSON.stringify(dest)});</script></head>
<body><p><a href="${esc(dest)}">Ver ${esc(p ? p.name : "o produto")} na LikindaLine</a></p></body></html>`);
};
