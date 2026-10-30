/* LikindaLine — painel de administração.
   - Com Supabase configurado (js/config.js): exige login; as permissões reais são impostas pelo servidor (RLS, ver supabase/schema.sql).
   - Sem Supabase: bloqueia o painel até o login seguro ser configurado. */
document.addEventListener("DOMContentLoaded", async () => {
  const S = window.Store;
  if (!S) return;
  const $ = (id) => document.getElementById(id);
  const CFG = S.CFG;
  const F = {
    id: $("product-id"),
    name: $("name"),
    price: $("price"),
    category: $("category"),
    image: $("image"),
    images: $("images"),
    description: $("description"),
    stock: $("stock"),
    featured: $("featured"),
    upload: $("upload"),
  };
  const form = $("product-form"),
    list = $("admin-product-list");
  let backend,
    client,
    products = [],
    selectedFiles = [],
    selectedTestimonialFile = null,
    testimonialPreviewUrl = "",
    previewObjectUrls = [],
    busy = false;

  const say = (el, text, error) => {
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(error));
  };
  const showView = (name) => {
    $("login-view").classList.toggle("hidden", name !== "login");
    $("panel-view").classList.toggle("hidden", name !== "panel");
  };

  /* ---------- backends ---------- */
  const toDB = (p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    category: p.category,
    description: p.description,
    image: p.image,
    images: p.images.slice(1),
    stock: p.stock,
    featured: p.featured,
  });
  const demoBackend = {
    async list() {
      return S.localGet();
    },
    async save(p, editing) {
      const all = S.localGet();
      S.localSet(
        editing ? all.map((x) => (x.id === p.id ? p : x)) : [p, ...all],
      );
    },
    async remove(id) {
      S.localSet(S.localGet().filter((x) => x.id !== id));
    },
  };
  const remoteBackend = {
    async list() {
      const { data, error } = await client
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(S.normalize);
    },
    async save(p, editing) {
      const q = editing
        ? client.from("products").update(toDB(p)).eq("id", p.id)
        : client.from("products").insert(toDB(p));
      const { error } = await q;
      if (error) throw error;
    },
    async remove(id) {
      const { error } = await client.from("products").delete().eq("id", id);
      if (error) throw error;
    },
  };
  const friendly = (e) =>
    /row-level security|permission|JWT|401|403/i.test(
      (e && (e.message || e.code)) || "",
    )
      ? "Sem permissão. Termina a sessão e entra novamente com a conta de administração."
      : e && e.name === "QuotaExceededError"
        ? "As fotografias excedem o espaço disponível neste navegador. Escolhe menos fotografias ou imagens mais pequenas."
      : "Não foi possível concluir a operação. Verifica a ligação e tenta novamente.";
  async function cleanupUploads(paths) {
    if (!paths.length) return;
    try {
      const { error } = await client.storage
        .from(CFG.STORAGE_BUCKET || "produtos")
        .remove(paths);
      if (error) console.error("Could not clean up uploaded images.", error);
    } catch (error) {
      console.error("Could not clean up uploaded images.", error);
    }
  }

  /* ---------- lista ---------- */
  async function refresh() {
    try {
      products = await backend.list();
    } catch (e) {
      say($("list-message"), friendly(e), true);
      products = [];
    }
    $("admin-product-count").textContent =
      `${products.length} ${products.length === 1 ? "produto" : "produtos"}${S.REMOTE ? "" : " neste navegador"}`;
    list.innerHTML = products.length
      ? products
          .map((p) => {
            const img = S.safeImage(S.thumb(p.image, 160));
            return `<article class="admin-product-row">
        ${img ? `<img src="${S.escapeHTML(img)}" alt="" width="60" height="60" loading="lazy">` : "<span></span>"}
        <div><h3>${S.escapeHTML(p.name)}</h3><p>${S.formatPrice(p.price)} <small>· ${S.escapeHTML(p.category)} · ${p.stock === "soldout" ? "Esgotado" : "Disponível"}${p.featured ? " · Destaque" : ""}</small></p></div>
        <div class="admin-row-actions"><button type="button" data-edit="${S.escapeHTML(p.id)}">Editar</button><button class="delete-button" type="button" data-delete="${S.escapeHTML(p.id)}">Eliminar</button></div>
      </article>`;
          })
          .join("")
      : '<div class="admin-empty">Ainda não há produtos. Usa o formulário para adicionar o primeiro.</div>';
  }

  async function refreshTestimonials() {
    const message = $("testimonial-list-message");
    try {
      const { data, error } = await client
        .from("testimonials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const entries = data || [];
      $("testimonial-count").textContent =
        `${entries.length} ${entries.length === 1 ? "publicação" : "publicações"}`;
      $("testimonial-list").innerHTML = entries.length
        ? entries
            .map((entry) => {
              const media =
                entry.kind === "image"
                  ? `<img src="${S.escapeHTML(S.safeImage(entry.content_url))}" alt="" width="60" height="60" loading="lazy">`
                  : '<span class="story-video-icon" aria-hidden="true">▶</span>';
              return `<article class="admin-product-row">
                ${media}
                <div><h3>${S.escapeHTML(entry.title)}</h3><p><small>${entry.kind === "video" ? "Vídeo do YouTube" : "Captura de conversa"}</small></p></div>
                <div class="admin-row-actions"><button class="delete-button" type="button" data-delete-testimonial="${S.escapeHTML(entry.id)}">Eliminar</button></div>
              </article>`;
            })
            .join("")
        : '<div class="admin-empty">Ainda não há publicações. Adiciona o primeiro vídeo ou captura.</div>';
      say(message, "");
      return entries;
    } catch (error) {
      console.error(error);
      say(
        message,
        "Não foi possível carregar as publicações. Confirma se executaste supabase/testimonials.sql.",
        true,
      );
      $("testimonial-count").textContent = "";
      $("testimonial-list").replaceChildren();
      return [];
    }
  }

  /* ---------- formulário ---------- */
  const extraUrls = () =>
    F.images.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  function validate() {
    const e = {},
      v = (k) => F[k].value.trim();
    if (v("name").length < 2)
      e.name = "Escreve o nome do produto (mínimo 2 letras).";
    const price = Number(v("price"));
    if (v("price") === "" || !Number.isInteger(price) || price < 0)
      e.price = "Indica o preço em Kz, só com números inteiros (ex.: 11000).";
    if (!selectedFiles.length && !S.safeImage(v("image")))
      e.image = "Carrega pelo menos uma fotografia do produto.";
    if (v("description").length < 10)
      e.description = "A descrição precisa de pelo menos 10 caracteres.";
    document.querySelectorAll("[data-error]").forEach((el) => {
      el.textContent = e[el.dataset.error] || "";
    });
    F.upload.classList.toggle("is-invalid", Boolean(e.image));
    Object.keys(F).forEach((k) =>
      F[k].classList.toggle("is-invalid", Boolean(e[k])),
    );
    return e;
  }
  function preview() {
    previewObjectUrls.forEach(URL.revokeObjectURL);
    previewObjectUrls = [];
    const urls = [F.image.value.trim(), ...extraUrls()]
      .map(S.safeImage)
      .filter(Boolean);
    selectedFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      previewObjectUrls.push(url);
      urls.push(url);
    });
    const row = $("preview-row");
    row.replaceChildren();
    urls.forEach((url, index) => {
      const img = document.createElement("img");
      img.src = S.safeImage(url) || url;
      img.alt = `Fotografia ${index + 1} do produto`;
      img.width = 72;
      img.height = 72;
      row.append(img);
    });
    $("upload-edit-note").classList.toggle("hidden", !F.id.value);
    $("image-status").textContent = selectedFiles.length
      ? `${selectedFiles.length} ${selectedFiles.length === 1 ? "fotografia selecionada" : "fotografias selecionadas"}; serão comprimidas ao guardar.`
      : urls.length
        ? `${urls.length} ${urls.length === 1 ? "fotografia atual" : "fotografias atuais"}.`
        : "A primeira fotografia será a imagem principal.";
  }
  function clearForm() {
    form.reset();
    F.id.value = "";
    selectedFiles = [];
    $("form-title").textContent = "Adicionar produto";
    $("save-button").textContent = "Guardar produto";
    $("cancel-edit").classList.add("hidden");
    say($("form-message"), "");
    document.querySelectorAll("[data-error]").forEach((el) => {
      el.textContent = "";
    });
    Object.values(F).forEach((el) => el.classList.remove("is-invalid"));
    preview();
  }
  function compress(file, max = 900, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const img = new Image(),
        url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * k));
        canvas.height = Math.max(1, Math.round(img.height * k));
        const context = canvas.getContext("2d");
        if (!context) {
          URL.revokeObjectURL(url);
          reject(new Error("Não foi possível preparar a fotografia."));
          return;
        }
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Não foi possível comprimir a fotografia.")),
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível abrir uma das fotografias."));
      };
      img.src = url;
    });
  }
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Não foi possível preparar a fotografia."));
      reader.onerror = () =>
        reject(new Error("Não foi possível ler uma das fotografias."));
      reader.readAsDataURL(blob);
    });
  }
  async function prepareImages() {
    if (!selectedFiles.length)
      return [F.image.value, ...extraUrls()].filter(Boolean);
    const urls = [],
      uploadedPaths = [],
      bucketName = CFG.STORAGE_BUCKET || "produtos";
    try {
      for (const file of selectedFiles) {
        const blob = await compress(file);
        if (S.REMOTE) {
          const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`,
            bucket = client.storage.from(bucketName),
            { error } = await bucket.upload(path, blob, {
              contentType: "image/jpeg",
              cacheControl: "31536000",
            });
          if (error) throw error;
          uploadedPaths.push(path);
          urls.push(bucket.getPublicUrl(path).data.publicUrl);
        } else {
          urls.push(await blobToDataUrl(blob));
        }
      }
      return { urls, uploadedPaths };
    } catch (error) {
      await cleanupUploads(uploadedPaths);
      throw error;
    }
  }
  function uniqueId(name) {
    const base = S.slugify(name);
    let id = base,
      n = 2;
    while (products.some((p) => p.id === id)) id = `${base}-${n++}`;
    return id;
  }
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (busy) return;
    const errors = validate();
    if (Object.keys(errors).length) {
      say(
        $("form-message"),
        "Corrige os campos assinalados antes de guardar.",
        true,
      );
      const first = form.querySelector(".is-invalid");
      if (first) first.focus();
      return;
    }
    const editing = Boolean(F.id.value);
    busy = true;
    $("save-button").disabled = true;
    let uploadedPaths = [];
    try {
      say(
        $("form-message"),
        selectedFiles.length ? "A preparar as fotografias..." : "A guardar produto...",
      );
      const prepared = await prepareImages();
      const urls = Array.isArray(prepared) ? prepared : prepared.urls;
      uploadedPaths = Array.isArray(prepared) ? [] : prepared.uploadedPaths;
      const p = {
        id: F.id.value || uniqueId(F.name.value),
        name: F.name.value.trim(),
        price: Number(F.price.value),
        category: F.category.value,
        image: urls[0],
        images: urls.slice(1),
        description: F.description.value.trim(),
        stock: F.stock.value,
        featured: F.featured.value === "yes",
      };
      say($("form-message"), "A guardar produto...");
      await backend.save(p, editing);
      uploadedPaths = [];
      clearForm();
      await refresh();
      say(
        $("form-message"),
        editing
          ? "Produto atualizado com sucesso."
          : "Produto adicionado com sucesso.",
      );
    } catch (err) {
      console.error(err);
      say($("form-message"), friendly(err), true);
      await cleanupUploads(uploadedPaths);
    }
    busy = false;
    $("save-button").disabled = false;
  });
  F.upload.addEventListener("change", () => {
    const files = [...F.upload.files],
      supported = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
    if (!files.length) return;
    const invalid = files.find(
      (file) => !supported.has(file.type) || file.size > 10 * 1024 * 1024,
    );
    if (files.length > 5 || invalid) {
      selectedFiles = [];
      F.upload.value = "";
      say(
        $("form-message"),
        files.length > 5
          ? "Podes carregar no máximo 5 fotografias de cada vez."
          : "Usa fotografias JPG, PNG, WebP ou GIF com até 10 MB cada.",
        true,
      );
    } else {
      selectedFiles = files;
      say($("form-message"), "");
    }
    preview();
  });

  const testimonialForm = $("testimonial-form");
  function updateTestimonialFields() {
    const isImage = $("testimonial-kind").value === "image";
    $("testimonial-video-fields").classList.toggle("hidden", isImage);
    $("testimonial-image-fields").classList.toggle("hidden", !isImage);
    $("testimonial-url").disabled = isImage;
    $("testimonial-image").disabled = !isImage;
    $("testimonial-consent").disabled = !isImage;
  }
  $("testimonial-kind").addEventListener("change", updateTestimonialFields);
  $("testimonial-image").addEventListener("change", () => {
    const file = $("testimonial-image").files[0];
    selectedTestimonialFile = null;
    if (testimonialPreviewUrl) URL.revokeObjectURL(testimonialPreviewUrl);
    testimonialPreviewUrl = "";
    $("testimonial-preview").replaceChildren();
    if (!file) return;
    const supported = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]);
    if (!supported.has(file.type) || file.size > 10 * 1024 * 1024) {
      $("testimonial-image").value = "";
      say(
        $("testimonial-message"),
        "Usa uma imagem JPG, PNG, WebP ou GIF com até 10 MB.",
        true,
      );
      return;
    }
    selectedTestimonialFile = file;
    testimonialPreviewUrl = URL.createObjectURL(file);
    const image = document.createElement("img");
    image.src = testimonialPreviewUrl;
    image.alt = "Pré-visualização da captura";
    $("testimonial-preview").append(image);
    say($("testimonial-message"), "");
  });
  testimonialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = $("testimonial-title").value.trim();
    const kind = $("testimonial-kind").value;
    const message = $("testimonial-message");
    if (title.length < 2) {
      say(message, "Escreve um título com pelo menos 2 caracteres.", true);
      $("testimonial-title").focus();
      return;
    }
    if (
      kind === "video" &&
      !S.youtubeEmbedUrl($("testimonial-url").value.trim())
    ) {
      say(message, "Cola um link válido de vídeo do YouTube.", true);
      $("testimonial-url").focus();
      return;
    }
    if (
      kind === "image" &&
      (!selectedTestimonialFile || !$("testimonial-consent").checked)
    ) {
      say(
        message,
        "Seleciona uma captura e confirma que tens autorização e removeste os dados pessoais.",
        true,
      );
      return;
    }

    $("testimonial-save").disabled = true;
    let uploadedPath = "";
    try {
      let contentUrl = $("testimonial-url").value.trim();
      if (kind === "image") {
        say(message, "A preparar e carregar a captura...");
        const blob = await compress(selectedTestimonialFile, 1600, 0.88);
        uploadedPath = `clientes/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
        const bucket = client.storage.from(CFG.STORAGE_BUCKET || "produtos");
        const { error: uploadError } = await bucket.upload(uploadedPath, blob, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
        });
        if (uploadError) throw uploadError;
        contentUrl = bucket.getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { error } = await client.from("testimonials").insert({
        title,
        kind,
        content_url: contentUrl,
        storage_path: uploadedPath || null,
      });
      if (error) throw error;
      testimonialForm.reset();
      selectedTestimonialFile = null;
      if (testimonialPreviewUrl) URL.revokeObjectURL(testimonialPreviewUrl);
      testimonialPreviewUrl = "";
      $("testimonial-preview").replaceChildren();
      updateTestimonialFields();
      say(message, "Publicação adicionada à loja.");
      await refreshTestimonials();
    } catch (error) {
      console.error(error);
      if (uploadedPath) await cleanupUploads([uploadedPath]);
      say(message, friendly(error), true);
    } finally {
      $("testimonial-save").disabled = false;
    }
  });
  updateTestimonialFields();
  $("testimonial-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-testimonial]");
    if (!button) return;
    const id = button.dataset.deleteTestimonial;
    const entry = (await refreshTestimonials()).find((item) => item.id === id);
    if (!entry || !confirm(`Eliminar "${entry.title}" da loja?`)) return;
    try {
      const { error } = await client
        .from("testimonials")
        .delete()
        .eq("id", id);
      if (error) throw error;
      let storageWarning = false;
      if (entry.storage_path) {
        const { error: storageError } = await client.storage
          .from(CFG.STORAGE_BUCKET || "produtos")
          .remove([entry.storage_path]);
        if (storageError) {
          console.error(storageError);
          storageWarning = true;
        }
      }
      await refreshTestimonials();
      say(
        $("testimonial-list-message"),
        storageWarning
          ? "A publicação foi eliminada, mas não foi possível apagar a imagem do Storage."
          : "Publicação eliminada.",
        storageWarning,
      );
    } catch (error) {
      console.error(error);
      say($("testimonial-list-message"), friendly(error), true);
    }
  });

  list.addEventListener("click", async (ev) => {
    const edit = ev.target.closest("[data-edit]"),
      del = ev.target.closest("[data-delete]");
    if (edit) {
      const p = products.find((x) => x.id === edit.dataset.edit);
      if (!p) return;
      clearForm();
      F.id.value = p.id;
      F.name.value = p.name;
      F.price.value = p.price;
      F.category.value = p.category;
      F.image.value = p.image;
      F.images.value = p.images.slice(1).join("\n");
      F.description.value = p.description;
      F.stock.value = p.stock;
      F.featured.value = p.featured ? "yes" : "no";
      $("form-title").textContent = "Editar produto";
      $("save-button").textContent = "Guardar alterações";
      $("cancel-edit").classList.remove("hidden");
      preview();
      say($("list-message"), "");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (del) {
      const p = products.find((x) => x.id === del.dataset.delete);
      if (
        !p ||
        !confirm(`Eliminar "${p.name}"? Esta ação não pode ser desfeita.`)
      )
        return;
      try {
        await backend.remove(p.id);
        if (F.id.value === p.id) clearForm();
        await refresh();
        say($("list-message"), `"${p.name}" foi eliminado.`);
      } catch (err) {
        console.error(err);
        say($("list-message"), friendly(err), true);
      }
    }
  });
  $("cancel-edit").addEventListener("click", clearForm);
  $("reset-demo").addEventListener("click", async () => {
    if (
      !confirm(
        "Repor os produtos de demonstração? Os produtos adicionados neste navegador serão eliminados.",
      )
    )
      return;
    S.localSet(S.demoProducts);
    clearForm();
    await refresh();
    say($("list-message"), "Produtos de demonstração repostos.");
  });

  /* ---------- sessão ---------- */
  async function enterPanel(session) {
    const { data, error } = await client
      .from("admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error || !data) {
      await client.auth.signOut();
      showView("login");
      say(
        $("login-message"),
        "Esta conta não tem permissão de administração.",
        true,
      );
      return;
    }
    $("admin-user").textContent = session.user.email;
    $("admin-session").classList.remove("hidden");
    showView("panel");
    await refresh();
    await refreshTestimonials();
  }
  $("login-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const email = $("login-email").value.trim(),
      password = $("login-password").value;
    if (!email || !password) {
      say($("login-message"), "Preenche o email e a palavra-passe.", true);
      return;
    }
    $("login-button").disabled = true;
    say($("login-message"), "A entrar...");
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });
    $("login-button").disabled = false;
    if (error) {
      say($("login-message"), "Email ou palavra-passe incorretos.", true);
      return;
    }
    $("login-password").value = "";
    say($("login-message"), "");
    await enterPanel(data.session);
  });
  $("logout-button").addEventListener("click", async () => {
    await client.auth.signOut();
    location.reload();
  });

  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const s = document.createElement("script");
      s.src =
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("supabase-js"));
      document.head.appendChild(s);
    });
  }

  /* ---------- arranque ---------- */
  const notice = $("mode-notice");
  if (!S.numberOk) {
    notice.classList.remove("hidden");
    notice.innerHTML =
      "<strong>Falta o número de WhatsApp.</strong> Define <code>WHATSAPP_NUMBER</code> em <code>js/config.js</code> antes de publicar.";
  }
  if (!S.REMOTE) {
    $("mode-pill").textContent = "Configuração necessária";
    notice.classList.remove("hidden");
    notice.innerHTML =
      "<strong>O login ainda não está configurado.</strong> Liga o Supabase preenchendo <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> em <code>js/config.js</code>. Depois, cria a tua conta e autoriza-a como administradora (ver README).";
    showView("login");
    $("login-email").disabled = true;
    $("login-password").disabled = true;
    $("login-button").disabled = true;
  } else {
    backend = remoteBackend;
    $("mode-pill").textContent = "Ligado ao Supabase";
    try {
      await loadSupabase();
      client = window.supabase.createClient(
        CFG.SUPABASE_URL,
        CFG.SUPABASE_ANON_KEY,
      );
      const { data } = await client.auth.getSession();
      if (data.session) await enterPanel(data.session);
      else showView("login");
    } catch (e) {
      console.error(e);
      showView("login");
      say(
        $("login-message"),
        "Não foi possível ligar ao serviço de autenticação.",
        true,
      );
      $("login-button").disabled = true;
    }
  }
});
