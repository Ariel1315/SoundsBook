/* ===================================================================
   SoundsBook — leitor de PDF: armazenamento local
   Tudo fica no navegador do usuário:
   - IndexedDB: texto extraído dos documentos (pode ser grande)
   - localStorage: preferências, anotações, posição, estatísticas
   Nada é enviado para servidores.
=================================================================== */
(function (raiz) {
  "use strict";

  const BANCO = "soundsbook_leitor";
  const LOJA = "docs";
  const PREFIXO = "sb_leitor_";

  /* ---------- localStorage com tratamento de erro ---------- */
  function ler(chave, padrao) {
    try {
      const v = localStorage.getItem(PREFIXO + chave);
      return v ? JSON.parse(v) : padrao;
    } catch (e) {
      return padrao;
    }
  }

  function gravar(chave, valor) {
    try {
      localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  function apagar(chave) {
    try {
      localStorage.removeItem(PREFIXO + chave);
    } catch (e) {
      /* ignora */
    }
  }

  /* ---------- IndexedDB ---------- */
  let conexao = null;

  function abrir() {
    if (conexao) return conexao;
    conexao = new Promise((resolver, rejeitar) => {
      if (!raiz.indexedDB) {
        rejeitar(new Error("IndexedDB indisponível"));
        return;
      }
      const req = raiz.indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(LOJA, { keyPath: "id" });
      };
      req.onsuccess = () => resolver(req.result);
      req.onerror = () => rejeitar(req.error);
    });
    return conexao;
  }

  function transacao(modo, funcao) {
    return abrir().then(
      (db) =>
        new Promise((resolver, rejeitar) => {
          const tx = db.transaction(LOJA, modo);
          const loja = tx.objectStore(LOJA);
          const req = funcao(loja);
          tx.oncomplete = () => resolver(req ? req.result : undefined);
          tx.onerror = () => rejeitar(tx.error);
          tx.onabort = () => rejeitar(tx.error);
        })
    );
  }

  function salvarDocumento(doc) {
    return transacao("readwrite", (l) => l.put(doc));
  }

  function carregarDocumento(id) {
    return transacao("readonly", (l) => l.get(id));
  }

  function removerDocumento(id) {
    return transacao("readwrite", (l) => l.delete(id)).then(() => {
      apagar("estado_" + id);
      const indice = ler("indice", []).filter((d) => d.id !== id);
      gravar("indice", indice);
    });
  }

  /* ---------- índice leve para o histórico (sem o texto) ---------- */
  function listarHistorico() {
    return ler("indice", []).sort((a, b) => b.ultimoAcesso - a.ultimoAcesso);
  }

  function atualizarIndice(meta) {
    const lista = ler("indice", []);
    const i = lista.findIndex((d) => d.id === meta.id);
    if (i >= 0) lista[i] = Object.assign(lista[i], meta);
    else lista.push(meta);
    gravar("indice", lista);
  }

  /* ---------- estado por documento (posição, notas, quiz, tempo) ---------- */
  function estadoPadrao() {
    return {
      posicao: 0,
      maximo: 0,
      audio: { p: 0, s: 0 },
      notas: [],
      revisar: [],
      segundos: 0
    };
  }

  function carregarEstado(id) {
    return Object.assign(estadoPadrao(), ler("estado_" + id, {}));
  }

  function salvarEstado(id, estado) {
    return gravar("estado_" + id, estado);
  }

  /* ---------- preferências e estatísticas globais ---------- */
  const PREFS_PADRAO = {
    tema: "claro",
    fonte: "serif",
    tamanho: 19,
    linha: 1.8,
    paragrafo: 18,
    largura: 700,
    justificar: false,
    destaqueParagrafo: true,
    acompanharAudio: true,
    velocidade: 1,
    voz: "",
    metaMinutos: 20
  };

  function carregarPrefs() {
    return Object.assign({}, PREFS_PADRAO, ler("prefs", {}));
  }

  function salvarPrefs(p) {
    return gravar("prefs", p);
  }

  function hoje() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dia;
  }

  function carregarDias() {
    return ler("dias", {});
  }

  function somarTempo(segundos) {
    const dias = carregarDias();
    const h = hoje();
    dias[h] = (dias[h] || 0) + segundos;
    gravar("dias", dias);
    return dias[h];
  }

  function gerarId(nome, tamanho, amostra) {
    let h = 5381;
    const texto = nome + "|" + tamanho + "|" + amostra;
    for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
    return "d" + (h >>> 0).toString(36) + tamanho.toString(36);
  }

  raiz.LeitorDados = {
    salvarDocumento: salvarDocumento,
    carregarDocumento: carregarDocumento,
    removerDocumento: removerDocumento,
    listarHistorico: listarHistorico,
    atualizarIndice: atualizarIndice,
    carregarEstado: carregarEstado,
    salvarEstado: salvarEstado,
    carregarPrefs: carregarPrefs,
    salvarPrefs: salvarPrefs,
    carregarDias: carregarDias,
    somarTempo: somarTempo,
    hoje: hoje,
    gerarId: gerarId
  };
})(typeof window !== "undefined" ? window : globalThis);
