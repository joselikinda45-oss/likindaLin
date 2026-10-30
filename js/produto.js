/* LikindaLine — página individual do produto (produto.html?id=...). */
document.addEventListener("DOMContentLoaded", async () => {
  const S = window.Store;
  if (!S) return;
  const $ = (id) => document.getElementById(id);
  const box = $("product-detail"),
    related = $("related-grid"),
    relatedSection = $("related-section");
  const id = new URLSearchParams(location.search).get("id");

  function setMeta(selector, value) {
    const el = document.querySelector(selector);
    if (el) el.setAttribute("content", value);
  }
  function notFound(title, text, list) {
    box.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span>?</span><h1 style="font-size:22px;margin:12px 0 6px;color:var(--ink)">${S.escapeHTML(title)}</h1><p>${S.escapeHTML(text)}</p><a class="button button-dark" href="index.html">Ver todos os produtos</a></div>`;
    $("crumb-product").textContent = "Não encontrado";
    document.title = "Produto não encontrado | LikindaLine";
    if (list && list.length)
      related.innerHTML = list.slice(0, 4).map(S.productCard).join("");
    else relatedSection.classList.add("hidden");
  }

  let all;
  try {
    all = await S.loadProducts();
  } catch (e) {
    notFound(
      "Não foi possível carregar o produto",
      "Verifica a ligação à Internet e tenta novamente.",
    );
    return;
  }

  const p = id ? all.find((x) => x.id === id) : null;
  if (!p) {
    notFound(
      "Produto não encontrado",
      "O produto pode ter sido removido ou o link está incorreto.",
      all,
    );
    return;
  }

  /* título e metadados (úteis para o navegador e motores de pesquisa; o Facebook usa /p/<id>, ver README) */
  const desc = `${S.formatPrice(p.price)} — ${p.description}`.slice(0, 200);
  document.title = `${p.name} | LikindaLine`;
  $("crumb-product").textContent = p.name;
  setMeta('meta[name="description"]', desc);
  setMeta('meta[property="og:title"]', `${p.name} | LikindaLine`);
  setMeta('meta[property="og:description"]', desc);
  setMeta('meta[property="og:url"]', S.shareUrl(p));
  if (/^https?:/.test(p.image)) setMeta('meta[property="og:image"]', p.image);

  const sold = p.stock === "soldout";
  const pics = p.images.map(S.safeImage).filter(Boolean);
  const thumbs =
    pics.length > 1
      ? `<div class="thumbs" role="group" aria-label="Fotografias">${pics
          .map(
            (src, i) =>
              `<button class="thumb" type="button" data-index="${i}" aria-label="Ver fotografia ${i + 1}" aria-current="${i === 0}"><img src="${S.escapeHTML(S.thumb(src, 160))}" alt="" width="68" height="68" loading="lazy" decoding="async"></button>`,
          )
          .join("")}</div>`
      : "";
  const link = S.shareUrl(p);

  box.innerHTML = `
    <div class="detail-gallery">
      <div class="detail-image-wrap">${pics[0] ? `<img class="detail-image" id="detail-main" src="${S.escapeHTML(S.thumb(pics[0], 1000))}" alt="${S.escapeHTML(p.name)}" width="1000" height="1000" decoding="async">` : ""}</div>
      ${thumbs}
    </div>
    <div class="detail-info">
      <span class="product-category">${S.escapeHTML(p.category)}</span>
      <h1>${S.escapeHTML(p.name)}</h1>
      <div class="detail-price">${S.formatPrice(p.price)}</div>
      <div class="detail-stock ${sold ? "soldout" : ""}">${sold ? "● Produto esgotado" : "● Disponível para consulta"}</div>
      <p class="detail-description">${S.escapeHTML(p.description)}</p>
      ${
        sold
          ? `<p class="detail-note">Este produto está esgotado de momento. Fala connosco para saberes quando volta.</p>
        <a class="button button-outline wa-btn" style="width:100%" data-whatsapp href="#"><img class="whatsapp-icon" src="img/whatsapp.svg" alt="">Perguntar pelo WhatsApp</a>`
          : `<a class="button whatsapp-buy wa-btn" href="${S.escapeHTML(S.whatsappLink(p))}" target="_blank" rel="noopener noreferrer"><img class="whatsapp-icon" src="img/whatsapp.svg" alt="">Comprar pelo WhatsApp</a>
        <p class="detail-note">Ao tocar no botão abre-se uma conversa com a mensagem já escrita. A compra só fica combinada depois de confirmares tudo connosco.</p>`
      }
      <div class="share-box">
        <strong>Partilhar este produto</strong>
        <div class="share-row">
          <input id="share-link" type="text" readonly value="${S.escapeHTML(link)}" aria-label="Link do produto">
          <button class="button button-dark" type="button" id="copy-link">Copiar link</button>
          <a class="button button-outline" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}">Facebook</a>
        </div>
      </div>
    </div>`;
  document.querySelectorAll("[data-whatsapp]").forEach((a) => {
    if (a.closest(".detail-info")) a.href = S.whatsappLink(p);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });

  const main = $("detail-main");
  box.addEventListener("click", (e) => {
    const t = e.target.closest(".thumb");
    if (t && main) {
      main.src = S.thumb(pics[+t.dataset.index], 1000);
      box
        .querySelectorAll(".thumb")
        .forEach((b) => b.setAttribute("aria-current", String(b === t)));
    }
  });
  $("copy-link").addEventListener("click", async (e) => {
    const input = $("share-link"),
      btn = e.currentTarget;
    try {
      await navigator.clipboard.writeText(input.value);
    } catch (_) {
      input.select();
      document.execCommand && document.execCommand("copy");
    }
    btn.textContent = "Link copiado";
    setTimeout(() => {
      btn.textContent = "Copiar link";
    }, 2000);
  });

  const others = all.filter((x) => x.id !== p.id);
  const list = [
    ...others.filter((x) => x.category === p.category),
    ...others.filter((x) => x.category !== p.category),
  ].slice(0, 4);
  if (list.length) related.innerHTML = list.map(S.productCard).join("");
  else relatedSection.classList.add("hidden");
});
