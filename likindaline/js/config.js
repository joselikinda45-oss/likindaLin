/* LikindaLine — CONFIGURAÇÃO ÚNICA.
   Este é o único sítio onde defines o número de WhatsApp, o domínio e o Supabase.
   Estes valores são públicos (vão para o navegador). NUNCA coloques aqui
   palavras-passe, a "service_role key" ou qualquer chave secreta. */
window.LIKINDALINE_CONFIG = {
  BRAND_NAME: "LikindaLine",

  // >>> INSERE AQUI O TEU NÚMERO DE WHATSAPP <<<
  // Formato internacional, só dígitos, sem "+", espaços ou traços.
  // Angola: 244 + 9 dígitos. Exemplo de formato: "244923456789"
  WHATSAPP_NUMBER: "244929731377",

  // Domínio público da loja, sem "/" final. Ex.: "https://likindaline.vercel.app"
  // Se ficar vazio, usa o endereço atual do navegador.
  SITE_URL: "",

  // Coloca true depois de publicar na Vercel com as variáveis de ambiente
  // SUPABASE_URL e SUPABASE_ANON_KEY. Passa a partilhar /p/<id>, que gera
  // a pré-visualização correta no Facebook (ver README).
  SHARE_PAGES: false,

  // Supabase (chave "anon"/"publishable" é pública por desenho; a segurança vem das regras RLS).
  SUPABASE_URL: "https://cglgdqhqmwkraeujwhvd.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_vnjuaLTneHG2_juIxDuDCA_qubJI3HN",
  STORAGE_BUCKET: "produtos",
};
