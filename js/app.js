/* LikindaLine — lógica partilhada (dados, formatação, WhatsApp, página inicial).
   Sem Supabase configurado, funciona em modo demonstração (localStorage do navegador). */
(function () {
  const CFG = window.LIKINDALINE_CONFIG || {};
  const BRAND = CFG.BRAND_NAME || "LikindaLine";
  const STORAGE_KEY = "likindaLineProducts";
  const OLD_KEY = "minhaLojaProducts";
  const REMOTE = Boolean(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);
  const CATEGORIES = [
    "Tecnologia",
    "Relógios",
    "Acessórios",
    "Moda",
    "Casa",
    "Outros",
  ];
  const u = (id, w) =>
    `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w || 900}&q=80`;

  const demoProducts = [
    {
      id: "sumax-g89",
      name: "Relógio Digital Sumax G89",
      price: 11000,
      category: "Relógios",
      image: u("photo-1523275335684-37898b6baf30"),
      images: [],
      description:
        "Relógio moderno para o dia a dia. Contacta-nos pelo WhatsApp para confirmar disponibilidade, características e entrega.",
      stock: "available",
      featured: true,
    },
    {
      id: "auscultadores",
      name: "Auscultadores sem fios",
      price: 8500,
      category: "Tecnologia",
      image: u("photo-1505740420928-5e560c06d30e"),
      images: [],
      description:
        "Auscultadores com um visual moderno. Contacta-nos para obter mais informações sobre o produto.",
      stock: "available",
      featured: false,
    },
    {
      id: "mala-urbana",
      name: "Mala urbana",
      price: 12500,
      category: "Acessórios",
      image: u("photo-1553062407-98eeb64c6a62"),
      images: [],
      description:
        "Mala prática para acompanhar a tua rotina. Confirma a disponibilidade antes de encomendar.",
      stock: "available",
      featured: false,
    },
    {
      id: "tenis-casual",
      name: "Ténis casual",
      price: 18000,
      category: "Moda",
      image: u("photo-1542291026-7eec264c27ff"),
      images: [],
      description:
        "Modelo casual para completar o teu estilo. Contacta-nos para consultar tamanhos e disponibilidade.",
      stock: "available",
      featured: true,
    },
  ];

  /* ---------- utilitários ---------- */
  const formatPrice = (p) =>
    String(Math.round(Number(p) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
    " Kz";
  const escapeHTML = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const safeImage = (url) => {
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(String(url)))
      return url;
    try {
      const p = new URL(url, location.href);
      return ["http:", "https:"].includes(p.protocol) ? p.href : "";
    } catch (_) {
      return "";
    }
  };
  const fold = (s) =>
    String(s || "")
      .toLocaleLowerCase("pt")
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
  const slugify = (s) =>
    fold(s)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "produto";
  const thumb = (url, w) =>
    /images\.unsplash\.com/.test(url)
      ? url.replace(/([?&])w=\d+/, `$1w=${w}`)
      : url;

  function normalize(p) {
    const main = p.image || (p.images && p.images[0]) || "";
    const extra = (p.images || []).filter((x) => x && x !== main);
    return {
      id: String(p.id),
      name: p.name || "",
      price: Number(p.price) || 0,
      category: p.category || "Outros",
      image: main,
      images: [main, ...extra].filter(Boolean),
      description: p.description || "",
      stock: p.stock === "soldout" ? "soldout" : "available",
      featured: Boolean(p.featured),
    };
  }

  /* ---------- URLs e WhatsApp ---------- */
  function baseUrl() {
    if (CFG.SITE_URL) return CFG.SITE_URL.replace(/\/+$/, "");
    return location.origin === "null"
      ? ""
      : location.origin +
          location.pathname.replace(/[^/]*$/, "").replace(/\/+$/, "");
  }
  const productUrl = (p) =>
    `${baseUrl()}/produto.html?id=${encodeURIComponent(p.id)}`;
  const shareUrl = (p) =>
    CFG.SHARE_PAGES
      ? `${baseUrl()}/p/${encodeURIComponent(p.id)}`
      : productUrl(p);
  const numberOk = /^\d{11,15}$/.test(String(CFG.WHATSAPP_NUMBER || ""));
  let warned = false;
  function whatsappLink(product) {
    if (!numberOk && !warned) {
      warned = true;
      console.warn(
        "LikindaLine: define WHATSAPP_NUMBER em js/config.js (ex.: 244923456789).",
      );
    }
    const msg = product
      ? `Olá! Tenho interesse no produto ${product.name}, anunciado por ${formatPrice(product.price)}. Gostaria de saber como posso comprar.\nLink: ${shareUrl(product)}`
      : `Olá! Gostaria de saber mais sobre os produtos da ${BRAND}.`;
    return `https://wa.me/${numberOk ? CFG.WHATSAPP_NUMBER : ""}?text=${encodeURIComponent(msg)}`;
  }

  function youtubeEmbedUrl(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") return "";
      let videoId = "";
      if (url.hostname === "youtu.be") {
        videoId = url.pathname.split("/").filter(Boolean)[0] || "";
      } else if (
        ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
          url.hostname,
        )
      ) {
        if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
        else videoId = url.pathname.split("/").filter(Boolean)[1] || "";
      }
      return /^[A-Za-z0-9_-]{11}$/.test(videoId)
        ? `https://www.youtube-nocookie.com/embed/${videoId}`
        : "";
    } catch {
      return "";
    }
  }

  /* ---------- dados ---------- */
  function localGet() {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(OLD_KEY);
      if (saved !== null) return JSON.parse(saved).map(normalize);
    } catch (e) {
      console.warn("Não foi possível ler os produtos guardados.", e);
    }
    return demoProducts.map(normalize);
  }
  const localSet = (list) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

  let cache = null;
  function loadProducts(force) {
    if (cache && !force) return cache;
    cache = (async () => {
      if (!REMOTE) return localGet();
      const res = await fetch(
        `${CFG.SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`,
        { headers: { apikey: CFG.SUPABASE_ANON_KEY } },
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      return (await res.json()).map(normalize);
    })();
    cache.catch(() => {
      cache = null;
    });
    return cache;
  }

  /* ---------- componentes ---------- */
  function productCard(p) {
    const img = safeImage(thumb(p.image, 520));
    const href = `produto.html?id=${encodeURIComponent(p.id)}`;
    const sold = p.stock === "soldout";
    return `<article class="product-card">
      <a class="product-image-wrap" href="${href}" tabindex="-1" aria-hidden="true">
        ${img ? `<img class="product-image" src="${escapeHTML(img)}" alt="" width="520" height="520" loading="lazy" decoding="async">` : ""}
        ${p.featured ? '<span class="product-badge">Destaque</span>' : ""}
      </a>
      <div class="product-card-body">
        <span class="product-category">${escapeHTML(p.category)}</span>
        <a class="product-name" href="${href}">${escapeHTML(p.name)}</a>
        <strong class="product-price">${formatPrice(p.price)}</strong>
        <span class="stock-label ${sold ? "soldout" : ""}">${sold ? "Esgotado" : "Disponível"}</span>
        <a class="button button-dark card-button" href="${href}">Ver detalhes</a>
      </div>
    </article>`;
  }
  const errorBox = (msg) =>
    `<div class="empty-state"><span>!</span><h3>${escapeHTML(msg)}</h3><button class="button button-dark" type="button" onclick="location.reload()">Tentar de novo</button></div>`;

  // imagens partidas ficam esbatidas (sem atributos inline)
  document.addEventListener(
    "error",
    (e) => {
      if (e.target.tagName === "IMG") e.target.classList.add("img-broken");
    },
    true,
  );

  function setupLinks() {
    document.querySelectorAll("[data-whatsapp]").forEach((a) => {
      a.href = whatsappLink(null);
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
    document.querySelectorAll("[data-year]").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  }

  async function renderStories() {
    const section = document.getElementById("clientes-satisfeitos");
    const grid = document.getElementById("stories-grid");
    if (!section || !grid || !REMOTE) return;
    try {
      const response = await fetch(
        `${CFG.SUPABASE_URL}/rest/v1/testimonials?select=*&order=created_at.desc`,
        { headers: { apikey: CFG.SUPABASE_ANON_KEY } },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const entries = await response.json();
      const cards = entries
        .map((entry) => {
          const title = escapeHTML(entry.title || "");
          if (entry.kind === "video") {
            const embedUrl = youtubeEmbedUrl(entry.content_url);
            return embedUrl
              ? `<article class="story-card"><iframe class="story-media" src="${embedUrl}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><h3>${title}</h3></article>`
              : "";
          }
          const imageUrl = safeImage(entry.content_url);
          return entry.kind === "image" && imageUrl
            ? `<article class="story-card"><img class="story-media" src="${escapeHTML(imageUrl)}" alt="${title}" loading="lazy" decoding="async"><h3>${title}</h3></article>`
            : "";
        })
        .filter(Boolean);
      if (cards.length) {
        grid.innerHTML = cards.join("");
        section.classList.remove("hidden");
      }
    } catch (error) {
      console.warn("Não foi possível carregar as publicações de clientes.", error);
    }
  }

  /* ---------- página inicial ---------- */
  async function renderHome() {
    const grid = document.getElementById("product-grid");
    if (!grid) return;
    const featuredGrid = document.getElementById("featured-grid");
    const featuredSection = document.getElementById("destaques");
    const chips = document.getElementById("category-row");
    const countEl = document.getElementById("product-count");
    const empty = document.getElementById("empty-state");
    const input = document.getElementById("search-input");
    const sortSelect = document.getElementById("product-sort");
    const clearFilters = document.getElementById("clear-filters");
    let all,
      category = "Todos",
      query = "",
      sortBy = "relevance";
    try {
      all = await loadProducts();
    } catch (e) {
      grid.innerHTML = errorBox("Não foi possível carregar os produtos.");
      countEl.textContent = "";
      return;
    }

    const feat = all.filter((p) => p.featured);
    featuredSection.classList.toggle("hidden", !feat.length);
    featuredGrid.innerHTML = feat.slice(0, 4).map(productCard).join("");
    const spot = document.getElementById("hero-product");
    const heroArt = document.querySelector(".hero-art");
    heroArt?.classList.toggle("hidden", !feat[0]);
    document
      .querySelector(".hero")
      ?.classList.toggle("hero-with-product", Boolean(feat[0]));
    if (spot && feat[0]) {
      const img = safeImage(thumb(feat[0].image, 700));
      spot.href = `produto.html?id=${encodeURIComponent(feat[0].id)}`;
      spot.innerHTML = `${img ? `<img src="${escapeHTML(img)}" alt="${escapeHTML(feat[0].name)}" width="700" height="700" decoding="async">` : ""}<span class="hero-card-caption"><small>Em destaque</small><strong>${escapeHTML(feat[0].name)}</strong><em>${formatPrice(feat[0].price)}</em></span>`;
      spot.classList.remove("hidden");
    }
    const cats = ["Todos", ...new Set(all.map((p) => p.category))];
    chips.innerHTML = cats
      .map(
        (c, i) =>
          `<button type="button" class="category-chip${i ? "" : " active"}" data-category="${escapeHTML(c)}" aria-pressed="${!i}">${escapeHTML(c)}</button>`,
      )
      .join("");

    function render() {
      const q = fold(query);
      const list = all.filter(
        (p) =>
          (category === "Todos" || p.category === category) &&
          fold(`${p.name} ${p.description} ${p.category}`).includes(q),
      );
      if (sortBy === "price-asc") list.sort((a, b) => a.price - b.price);
      if (sortBy === "price-desc") list.sort((a, b) => b.price - a.price);
      if (sortBy === "name")
        list.sort((a, b) => a.name.localeCompare(b.name, "pt"));
      grid.innerHTML = list.map(productCard).join("");
      countEl.textContent = `${list.length} ${list.length === 1 ? "produto" : "produtos"}`;
      empty.classList.toggle("hidden", list.length > 0);
    }
    chips.addEventListener("click", (e) => {
      const b = e.target.closest("[data-category]");
      if (!b) return;
      category = b.dataset.category;
      chips
        .querySelectorAll(".category-chip")
        .forEach((c) => {
          const active = c === b;
          c.classList.toggle("active", active);
          c.setAttribute("aria-pressed", String(active));
        });
      render();
    });
    document.getElementById("search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      query = input.value.trim();
      render();
      document
        .getElementById("catalogo")
        .scrollIntoView({ behavior: "smooth" });
    });
    input.addEventListener("input", () => {
      query = input.value.trim();
      render();
    });
    sortSelect.addEventListener("change", () => {
      sortBy = sortSelect.value;
      render();
    });
    clearFilters.addEventListener("click", () => {
      category = "Todos";
      query = "";
      sortBy = "relevance";
      input.value = "";
      sortSelect.value = sortBy;
      const allCategories = chips.querySelectorAll(".category-chip");
      allCategories.forEach((chip, index) => {
        const active = index === 0;
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
      render();
      input.focus();
    });
    render();
  }

  window.Store = {
    CFG,
    REMOTE,
    CATEGORIES,
    demoProducts,
    loadProducts,
    localGet,
    localSet,
    normalize,
    formatPrice,
    escapeHTML,
    safeImage,
    thumb,
    slugify,
    productUrl,
    shareUrl,
    whatsappLink,
    youtubeEmbedUrl,
    productCard,
    errorBox,
    numberOk,
  };
  document.addEventListener("DOMContentLoaded", () => {
    setupLinks();
    renderHome();
    renderStories();
  });
})();
