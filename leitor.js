/* ===================================================================
   SoundsBook — leitor de PDF
   Tudo roda no navegador (compatível com GitHub Pages, sem servidor).
=================================================================== */
(function () {
  "use strict";

  const LT = window.LeitorTexto;
  const LD = window.LeitorDados;

  /* ---------- atalhos ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const telaInicio = $("#telaInicio");
  const telaLeitura = $("#telaLeitura");
  const coluna = $("#colunaTexto");
  const layout = $("#leitorLayout");
  const painel = $("#painelFerramentas");

  const FONTES = {
    serif: "'Fraunces', serif",
    sans: "'Inter', sans-serif",
    classica: "Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, Menlo, Consolas, monospace"
  };

  const NOME_COR = { amarelo: "Amarelo", verde: "Verde", azul: "Azul", rosa: "Rosa" };

  let prefs = LD.carregarPrefs();
  let doc = null;
  let estado = null;
  let indice = null;
  let parasEl = [];
  let atual = 0;
  let observador = null;
  let abaAtual = null;
  let ultimaAtividade = Date.now();
  let segundosPendentes = 0;
  let intervaloTempo = null;
  let busca = { termo: "", achados: [], atual: -1, porPar: new Map() };
  let selecaoAtual = null;
  let sessaoEstudo = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function minutos(seg) {
    const m = Math.floor(seg / 60);
    if (m < 60) return m + " min";
    return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min";
  }

  let temporizadorAviso = null;
  function aviso(texto, ms) {
    const el = $("#avisoFlutuante");
    el.textContent = texto;
    el.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => (el.hidden = true), ms || 3200);
  }

  /* ===================================================================
     APARÊNCIA
  =================================================================== */
  function aplicarPrefs() {
    const raiz = document.documentElement;
    raiz.setAttribute("data-tema", prefs.tema);
    raiz.style.setProperty("--fonte-leitura", FONTES[prefs.fonte] || FONTES.serif);
    raiz.style.setProperty("--tam-leitura", prefs.tamanho + "px");
    raiz.style.setProperty("--linha-leitura", String(prefs.linha));
    raiz.style.setProperty("--espaco-paragrafo", prefs.paragrafo + "px");
    raiz.style.setProperty("--largura-coluna", prefs.largura + "px");

    coluna.classList.toggle("justificado", !!prefs.justificar);
    coluna.classList.toggle("destaque_ligado", !!prefs.destaqueParagrafo);

    $$("#grupoTema button").forEach((b) => b.classList.toggle("ativo", b.dataset.tema === prefs.tema));
    $("#selFonte").value = prefs.fonte;
    $("#rngTamanho").value = prefs.tamanho;
    $("#outTamanho").textContent = prefs.tamanho + " px";
    $("#rngLinha").value = prefs.linha;
    $("#outLinha").textContent = Number(prefs.linha).toFixed(2).replace(".", ",");
    $("#rngParagrafo").value = prefs.paragrafo;
    $("#outParagrafo").textContent = prefs.paragrafo + " px";
    $("#rngLargura").value = prefs.largura;
    $("#outLargura").textContent = prefs.largura + " px";
    $("#chkJustificar").checked = !!prefs.justificar;
    $("#chkDestaque").checked = !!prefs.destaqueParagrafo;
    $("#chkAcompanhar").checked = !!prefs.acompanharAudio;
    $("#rngVelocidade").value = prefs.velocidade;
    $("#outVelocidade").textContent = String(prefs.velocidade).replace(".", ",") + "×";
    $("#audioVelocidade").value = String(prefs.velocidade);
  }

  function mudarPref(chave, valor) {
    prefs[chave] = valor;
    LD.salvarPrefs(prefs);
    aplicarPrefs();
  }

  function ligarAparencia() {
    $$("#grupoTema button").forEach((b) => b.addEventListener("click", () => mudarPref("tema", b.dataset.tema)));
    $("#selFonte").addEventListener("change", (e) => mudarPref("fonte", e.target.value));
    $("#rngTamanho").addEventListener("input", (e) => mudarPref("tamanho", Number(e.target.value)));
    $("#rngLinha").addEventListener("input", (e) => mudarPref("linha", Number(e.target.value)));
    $("#rngParagrafo").addEventListener("input", (e) => mudarPref("paragrafo", Number(e.target.value)));
    $("#rngLargura").addEventListener("input", (e) => mudarPref("largura", Number(e.target.value)));
    $("#chkJustificar").addEventListener("change", (e) => mudarPref("justificar", e.target.checked));
    $("#chkDestaque").addEventListener("change", (e) => mudarPref("destaqueParagrafo", e.target.checked));
    $("#chkAcompanhar").addEventListener("change", (e) => mudarPref("acompanharAudio", e.target.checked));
    $("#btnRestaurarAparencia").addEventListener("click", () => {
      Object.assign(prefs, { tema: "claro", fonte: "serif", tamanho: 19, linha: 1.8, paragrafo: 18, largura: 700, justificar: false, destaqueParagrafo: true });
      LD.salvarPrefs(prefs);
      aplicarPrefs();
    });
  }

  /* ===================================================================
     TELA INICIAL: resumo, histórico e envio
  =================================================================== */
  function chaveData(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function sequencia(dias, metaSeg) {
    if (metaSeg <= 0) return 0;
    let n = 0;
    const d = new Date();
    if ((dias[chaveData(d)] || 0) < metaSeg) d.setDate(d.getDate() - 1);
    while ((dias[chaveData(d)] || 0) >= metaSeg) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function renderInicio() {
    const dias = LD.carregarDias();
    const hojeSeg = dias[LD.hoje()] || 0;
    const metaSeg = prefs.metaMinutos * 60;
    const total = Object.values(dias).reduce((a, b) => a + b, 0);

    $("#resumoDia").innerHTML =
      '<div class="cartao_num"><strong>' + minutos(hojeSeg) + "</strong><span>lidos hoje (meta: " + prefs.metaMinutos + " min)</span></div>" +
      '<div class="cartao_num"><strong>' + sequencia(dias, metaSeg) + "</strong><span>dias seguidos cumprindo a meta</span></div>" +
      '<div class="cartao_num"><strong>' + minutos(total) + "</strong><span>de leitura no total</span></div>";

    const lista = LD.listarHistorico();
    const alvo = $("#listaDocs");
    if (!lista.length) {
      alvo.innerHTML = '<p class="vazio">Nenhum documento ainda. Envie um PDF acima para começar.</p>';
      return;
    }
    alvo.innerHTML = lista
      .map((d) => {
        const pct = Math.round((d.progresso || 0) * 100);
        return (
          '<div class="doc_card"><h3>' + esc(d.titulo) + "</h3>" +
          '<div class="doc_barra"><span style="width:' + pct + '%"></span></div>' +
          '<p class="doc_meta">' + pct + "% lido · " + d.paginas + " págs. · " + minutos(d.segundos || 0) +
          " · aberto em " + new Date(d.ultimoAcesso).toLocaleDateString("pt-BR") + "</p>" +
          '<div class="linha_botoes"><button class="btn_primario" data-abrir="' + d.id + '" type="button">' + (pct > 0 ? "Continuar" : "Abrir") + "</button>" +
          '<button class="btn_secundario" data-remover="' + d.id + '" type="button">Remover</button></div></div>'
        );
      })
      .join("");
  }

  function mostrarErro(texto) {
    const e = $("#erroUpload");
    e.textContent = texto;
    e.hidden = !texto;
  }

  function progressoUpload(texto, pct) {
    const box = $("#processando");
    box.hidden = texto === null;
    if (texto !== null) {
      $("#processandoTexto").textContent = texto;
      $("#processandoBarra").style.width = Math.round(pct) + "%";
    }
  }

  function lerArquivo(arquivo) {
    return new Promise((resolver, rejeitar) => {
      const leitor = new FileReader();
      leitor.onload = () => resolver(leitor.result);
      leitor.onerror = () => rejeitar(leitor.error);
      leitor.readAsArrayBuffer(arquivo);
    });
  }

  async function tratarArquivo(arquivo) {
    mostrarErro("");
    if (!arquivo) return;
    if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== "application/pdf") {
      mostrarErro("Este arquivo não parece ser um PDF. Escolha um arquivo com extensão .pdf.");
      return;
    }
    if (arquivo.size > 200 * 1024 * 1024) {
      mostrarErro("O arquivo é muito grande (limite de 200 MB).");
      return;
    }
    if (!window.pdfjsLib) {
      mostrarErro("Não foi possível carregar o leitor de PDF. Verifique sua conexão com a internet e recarregue a página.");
      return;
    }

    try {
      progressoUpload("Lendo o arquivo…", 2);
      const buffer = await lerArquivo(arquivo);
      const amostra = Array.from(new Uint8Array(buffer.slice(0, 1500))).reduce((a, b) => (a + b) % 100003, 0);
      const id = LD.gerarId(arquivo.name, arquivo.size, amostra);

      const existente = await LD.carregarDocumento(id).catch(() => null);
      if (existente) {
        progressoUpload(null);
        aviso("Este documento já estava na sua biblioteca. Abrindo…");
        abrirDocumento(existente);
        return;
      }

      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;

      const resultado = await LT.extrairParagrafos(pdf, (n, total) => {
        progressoUpload("Extraindo o texto: página " + n + " de " + total, 5 + (n / total) * 90);
      });

      const caracteres = resultado.paragrafos.reduce((s, p) => s + p.t.length, 0);
      if (resultado.paragrafos.length < 3 || caracteres < 300) {
        progressoUpload(null);
        mostrarErro("Não encontrei texto neste PDF. Ele provavelmente é composto de imagens (documento escaneado), e ainda não há reconhecimento de texto (OCR) nesta versão.");
        return;
      }

      const capitulos = LT.detectarCapitulos(resultado.paragrafos, resultado.paginas);
      const novo = {
        id: id,
        nome: arquivo.name,
        titulo: arquivo.name.replace(/\.pdf$/i, "").replace(/[_]+/g, " "),
        paginas: resultado.paginas,
        paragrafos: resultado.paragrafos,
        capitulos: capitulos,
        criadoEm: Date.now()
      };

      progressoUpload("Salvando no navegador…", 98);
      let salvo = true;
      try {
        await LD.salvarDocumento(novo);
      } catch (e) {
        salvo = false;
      }
      LD.atualizarIndice({ id: id, titulo: novo.titulo, paginas: novo.paginas, ultimoAcesso: Date.now(), progresso: 0, segundos: 0 });
      progressoUpload(null);
      if (!salvo) aviso("O documento abre agora, mas não coube no armazenamento do navegador e não ficará no histórico.", 6000);
      abrirDocumento(novo);
    } catch (e) {
      progressoUpload(null);
      if (e && e.name === "PasswordException") {
        mostrarErro("Este PDF está protegido por senha. Remova a proteção e envie novamente.");
      } else {
        mostrarErro("Não consegui abrir este PDF. O arquivo pode estar corrompido.");
      }
      console.error(e);
    }
  }

  function ligarInicio() {
    const input = $("#arquivoPdf");
    input.addEventListener("change", () => {
      tratarArquivo(input.files[0]);
      input.value = "";
    });

    const zona = $("#zonaUpload");
    ["dragenter", "dragover"].forEach((ev) =>
      zona.addEventListener(ev, (e) => {
        e.preventDefault();
        zona.classList.add("arrastando");
      })
    );
    ["dragleave", "drop"].forEach((ev) =>
      zona.addEventListener(ev, (e) => {
        e.preventDefault();
        zona.classList.remove("arrastando");
      })
    );
    zona.addEventListener("drop", (e) => {
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) tratarArquivo(f);
    });

    $("#listaDocs").addEventListener("click", async (e) => {
      const abrir = e.target.closest("[data-abrir]");
      const remover = e.target.closest("[data-remover]");
      if (abrir) {
        try {
          const d = await LD.carregarDocumento(abrir.dataset.abrir);
          if (d) abrirDocumento(d);
          else aviso("Não encontrei este documento no navegador.");
        } catch (err) {
          aviso("Não consegui abrir o documento salvo.");
        }
      }
      if (remover && window.confirm("Remover este documento, suas anotações e seu progresso deste navegador?")) {
        await LD.removerDocumento(remover.dataset.remover);
        renderInicio();
      }
    });
  }

  /* ===================================================================
     ABRIR DOCUMENTO E RENDERIZAR
  =================================================================== */
  function abrirDocumento(d) {
    pararAudio(true);
    doc = d;
    estado = LD.carregarEstado(d.id);
    indice = LT.criarIndice(d.paragrafos);
    busca = { termo: "", achados: [], atual: -1, porPar: new Map() };
    sessaoEstudo = null;
    atual = Math.min(estado.posicao || 0, d.paragrafos.length - 1);

    $("#tituloDoc").textContent = d.titulo;
    $("#subtituloDoc").textContent = d.paginas + " páginas · " + d.capitulos.length + " seções";

    telaInicio.hidden = true;
    telaLeitura.hidden = false;
    document.title = d.titulo + " - SoundsBook";

    renderTexto();
    renderCapitulos();
    preencherSelecoes();
    layout.classList.toggle("sem_esquerda", window.innerWidth <= 900);
    fecharPainelFerramentas();
    atualizarFoco(atual, true);
    atualizarBarraAudio();

    requestAnimationFrame(() => {
      irParaParagrafo(atual, { suave: false, centro: true });
      setTimeout(() => irParaParagrafo(atual, { suave: false, centro: true }), 300);
    });

    LD.atualizarIndice({ id: d.id, ultimoAcesso: Date.now() });
    iniciarContagemTempo();
  }

  function voltarParaLista() {
    pararAudio(true);
    sairFoco();
    salvarTudo();
    pararContagemTempo();
    doc = null;
    telaLeitura.hidden = true;
    telaInicio.hidden = false;
    document.title = "SoundsBook - Leitor de PDF";
    window.scrollTo(0, 0);
    renderInicio();
  }

  const ICONE_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

  function renderTexto() {
    coluna.textContent = "";
    parasEl = [];
    const frag = document.createDocumentFragment();

    doc.paragrafos.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "par" + (p.h ? " titulo" : "");
      div.dataset.i = i;
      div.id = "p" + i;

      const txt = document.createElement("span");
      txt.className = "par_txt";
      txt.textContent = p.t;
      div.appendChild(txt);

      if (!p.h) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "par_play";
        b.setAttribute("aria-label", "Ouvir a partir deste parágrafo");
        b.dataset.ouvir = i;
        b.innerHTML = ICONE_PLAY;
        div.insertBefore(b, txt);
      }
      frag.appendChild(div);
      parasEl.push(div);
    });
    coluna.appendChild(frag);

    estado.notas.forEach((n) => pintarParagrafo(n.p));
    configurarObservador();
    aplicarPrefs();
  }

  function configurarObservador() {
    if (observador) observador.disconnect();
    const visiveis = new Set();
    observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          const i = Number(e.target.dataset.i);
          if (e.isIntersecting) visiveis.add(i);
          else visiveis.delete(i);
        });
        if (visiveis.size) {
          const novo = Math.max.apply(null, Array.from(visiveis));
          if (novo !== atual) atualizarFoco(novo, false);
        }
      },
      { rootMargin: "-38% 0px -57% 0px", threshold: 0 }
    );
    parasEl.forEach((p) => observador.observe(p));
  }

  function atualizarFoco(i, forcar) {
    if (!forcar && i === atual && parasEl[i] && parasEl[i].classList.contains("foco")) return;
    if (parasEl[atual]) parasEl[atual].classList.remove("foco");
    atual = i;
    if (parasEl[i]) parasEl[i].classList.add("foco");

    estado.posicao = i;
    if (i > estado.maximo) estado.maximo = i;

    atualizarCapituloAtual();
    $("#fimTexto").hidden = estado.maximo < doc.paragrafos.length - 1 || i < doc.paragrafos.length - 2;
  }

  function irParaParagrafo(i, opcoes) {
    const o = opcoes || {};
    const el = parasEl[i];
    if (!el) return;
    el.scrollIntoView({ block: o.centro ? "center" : "start", behavior: o.suave === false ? "auto" : "smooth" });
    if (o.piscar) {
      el.classList.remove("piscar_par");
      void el.offsetWidth;
      el.classList.add("piscar_par");
    }
  }

  /* ---------- capítulos ---------- */
  function renderCapitulos() {
    $("#listaCapitulos").innerHTML = doc.capitulos
      .map(
        (c, i) =>
          '<li data-cap="' + i + '"><button type="button" data-ir="' + c.inicio + '">' + esc(c.titulo) +
          '<span class="cap_barra"><span style="width:0%"></span></span></button></li>'
      )
      .join("");
    atualizarProgressoCapitulos();
  }

  function atualizarProgressoCapitulos() {
    const itens = $$("#listaCapitulos li");
    doc.capitulos.forEach((c, i) => {
      const tam = c.fim - c.inicio + 1;
      const lidos = Math.max(0, Math.min(tam, estado.maximo - c.inicio + 1));
      const barra = itens[i] && itens[i].querySelector(".cap_barra span");
      if (barra) barra.style.width = Math.round((lidos / tam) * 100) + "%";
    });
  }

  function capituloDe(p) {
    const par = doc.paragrafos[p];
    return par && par.c !== undefined ? par.c : 0;
  }

  let ultimoCap = -1;
  let ultimoSalvamento = 0;
  function atualizarCapituloAtual() {
    const c = capituloDe(atual);
    if (c !== ultimoCap) {
      ultimoCap = c;
      $$("#listaCapitulos li").forEach((li) => li.classList.toggle("atual", Number(li.dataset.cap) === c));
      const li = $("#listaCapitulos li.atual");
      if (li && !painelCapEscondido()) li.scrollIntoView({ block: "nearest" });
    }
    atualizarProgressoCapitulos();
    const agora = Date.now();
    if (agora - ultimoSalvamento > 2500) {
      ultimoSalvamento = agora;
      LD.salvarEstado(doc.id, estado);
    }
  }

  function painelCapEscondido() {
    return layout.classList.contains("sem_esquerda");
  }

  /* ===================================================================
     PINTURA DE MARCAÇÕES (notas, busca e narração)
  =================================================================== */
  function pintarParagrafo(i) {
    const el = parasEl[i];
    if (!el) return;
    const txtEl = el.querySelector(".par_txt");
    const texto = doc.paragrafos[i].t;
    const marcas = [];

    estado.notas.forEach((n) => {
      if (n.p !== i) return;
      let cls = "marca";
      if (n.tipo === "citacao") cls += " m_citacao";
      else cls += " m_" + n.cor;
      if (n.tipo === "comentario") cls += " m_comentario";
      marcas.push({ ini: n.ini, fim: n.fim, cls: cls, nota: n.id });
    });

    const achados = busca.porPar.get(i);
    if (achados) {
      achados.forEach((a) => marcas.push({ ini: a.ini, fim: a.fim, cls: a.atual ? "m_busca_atual" : "m_busca" }));
    }

    if (tts.marca && tts.marca.p === i) {
      if (tts.marca.frase) marcas.push({ ini: tts.marca.frase.ini, fim: tts.marca.frase.fim, cls: "m_frase" });
      if (tts.marca.palavra) marcas.push({ ini: tts.marca.palavra.ini, fim: tts.marca.palavra.fim, cls: "m_palavra" });
    }

    if (!marcas.length) {
      if (txtEl.childElementCount || txtEl.textContent !== texto) txtEl.textContent = texto;
      return;
    }

    const pontos = new Set([0, texto.length]);
    marcas.forEach((m) => {
      pontos.add(Math.max(0, Math.min(texto.length, m.ini)));
      pontos.add(Math.max(0, Math.min(texto.length, m.fim)));
    });
    const ordenados = Array.from(pontos).sort((a, b) => a - b);

    let html = "";
    for (let k = 0; k < ordenados.length - 1; k++) {
      const a = ordenados[k];
      const b = ordenados[k + 1];
      if (a === b) continue;
      const cobrindo = marcas.filter((m) => m.ini <= a && m.fim >= b);
      const trecho = esc(texto.slice(a, b));
      if (!cobrindo.length) {
        html += trecho;
      } else {
        const classes = cobrindo.map((m) => m.cls).join(" ");
        const nota = cobrindo.find((m) => m.nota);
        html += "<span class=\"" + classes + "\"" + (nota ? ' data-nota="' + nota.nota + '"' : "") + ">" + trecho + "</span>";
      }
    }
    txtEl.innerHTML = html;
  }

  /* ===================================================================
     SELEÇÃO DE TEXTO → NOTAS
  =================================================================== */
  const barraSel = $("#barraSelecao");

  function deslocamento(raiz, no, desloc) {
    const r = document.createRange();
    r.selectNodeContents(raiz);
    r.setEnd(no, desloc);
    return r.toString().length;
  }

  function lerSelecao() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const noIni = range.startContainer.nodeType === 3 ? range.startContainer.parentElement : range.startContainer;
    const par = noIni && noIni.closest ? noIni.closest(".par") : null;
    if (!par || !coluna.contains(par)) return null;

    const i = Number(par.dataset.i);
    if (doc.paragrafos[i].h) return null;
    const txtEl = par.querySelector(".par_txt");
    if (!txtEl.contains(range.startContainer)) return null;

    const ini = deslocamento(txtEl, range.startContainer, range.startOffset);
    let fim;
    let cortada = false;
    if (txtEl.contains(range.endContainer)) {
      fim = deslocamento(txtEl, range.endContainer, range.endOffset);
    } else {
      fim = doc.paragrafos[i].t.length;
      cortada = true;
    }
    const texto = doc.paragrafos[i].t.slice(ini, fim);
    if (!texto.trim()) return null;

    const caixa = range.getBoundingClientRect();
    return { p: i, ini: ini, fim: fim, texto: texto, caixa: caixa, cortada: cortada };
  }

  function mostrarBarraSelecao() {
    const s = lerSelecao();
    if (!s) {
      if (!$("#selComentarioBox").hidden) return;
      barraSel.hidden = true;
      selecaoAtual = null;
      return;
    }
    selecaoAtual = s;
    barraSel.hidden = false;
    $("#selComentarioBox").hidden = true;

    const w = barraSel.offsetWidth;
    const h = barraSel.offsetHeight;
    let topo = s.caixa.top - h - 10;
    if (topo < 70) topo = s.caixa.bottom + 10;
    let esq = s.caixa.left + s.caixa.width / 2 - w / 2;
    esq = Math.max(8, Math.min(window.innerWidth - w - 8, esq));
    barraSel.style.top = topo + "px";
    barraSel.style.left = esq + "px";
  }

  function esconderBarraSelecao() {
    barraSel.hidden = true;
    $("#selComentarioBox").hidden = true;
    $("#selComentarioTexto").value = "";
    selecaoAtual = null;
  }

  function novoId() {
    return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function criarNota(tipo, cor, comentario) {
    if (!selecaoAtual) return;
    const s = selecaoAtual;
    const nota = {
      id: novoId(),
      tipo: tipo,
      cor: cor || "amarelo",
      p: s.p,
      ini: s.ini,
      fim: s.fim,
      texto: s.texto,
      comentario: comentario || "",
      cap: capituloDe(s.p),
      criada: Date.now()
    };
    estado.notas.push(nota);
    LD.salvarEstado(doc.id, estado);
    window.getSelection().removeAllRanges();
    esconderBarraSelecao();
    pintarParagrafo(s.p);
    if (abaAtual === "notas") renderNotas();
    if (s.cortada) aviso("A anotação foi limitada ao parágrafo onde a seleção começou.");
    else aviso(tipo === "citacao" ? "Citação salva." : tipo === "comentario" ? "Comentário salvo." : "Trecho grifado.", 1800);
  }

  function ligarSelecao() {
    document.addEventListener("selectionchange", () => {
      clearTimeout(ligarSelecao.t);
      ligarSelecao.t = setTimeout(() => {
        if (!telaLeitura.hidden) mostrarBarraSelecao();
      }, 180);
    });

    document.addEventListener("mousedown", (e) => {
      if (!barraSel.hidden && !barraSel.contains(e.target)) {
        if ($("#selComentarioBox").hidden) barraSel.hidden = true;
      }
    });

    $$(".selecao_cores .cor").forEach((b) => b.addEventListener("click", () => criarNota("grifo", b.dataset.cor)));
    $("#selCitar").addEventListener("click", () => criarNota("citacao", "amarelo"));
    $("#selComentar").addEventListener("click", () => {
      $("#selComentarioBox").hidden = false;
      $("#selComentarioTexto").focus();
    });
    $("#selComentarioSalvar").addEventListener("click", () => {
      const t = $("#selComentarioTexto").value.trim();
      if (!t) {
        aviso("Escreva o comentário antes de salvar.", 1800);
        return;
      }
      criarNota("comentario", "amarelo", t);
    });
    $("#selComentarioCancelar").addEventListener("click", esconderBarraSelecao);
    $("#selOuvir").addEventListener("click", () => {
      if (!selecaoAtual) return;
      const p = selecaoAtual.p;
      const ini = selecaoAtual.ini;
      window.getSelection().removeAllRanges();
      esconderBarraSelecao();
      const sents = sentencasDe(p);
      let s = 0;
      sents.forEach((x, k) => {
        if (x.ini <= ini) s = k;
      });
      iniciarAudio(p, s);
    });

    coluna.addEventListener("click", (e) => {
      const marca = e.target.closest("[data-nota]");
      if (marca && window.getSelection().isCollapsed) {
        abrirAba("notas");
        const card = $('.nota[data-id="' + marca.dataset.nota + '"]');
        if (card) {
          card.scrollIntoView({ block: "center" });
          card.classList.remove("piscar");
          void card.offsetWidth;
          card.classList.add("piscar");
        }
      }
      const ouvir = e.target.closest("[data-ouvir]");
      if (ouvir) iniciarAudio(Number(ouvir.dataset.ouvir), 0);
    });
  }

  /* ---------- lista e exportação de notas ---------- */
  const ROTULO_TIPO = { grifo: "Grifo", comentario: "Comentário", citacao: "Citação" };

  function notasOrdenadas() {
    return estado.notas.slice().sort((a, b) => a.p - b.p || a.ini - b.ini);
  }

  function renderNotas() {
    const alvo = $("#listaNotas");
    if (!estado.notas.length) {
      alvo.innerHTML = '<p class="vazio" style="margin-top:10px">Nenhuma anotação ainda. Selecione um trecho do texto para começar.</p>';
      return;
    }
    const grupos = new Map();
    notasOrdenadas().forEach((n) => {
      const c = capituloDe(n.p);
      if (!grupos.has(c)) grupos.set(c, []);
      grupos.get(c).push(n);
    });

    let html = "";
    grupos.forEach((lista, c) => {
      html += '<div class="nota_grupo"><h4>' + esc(doc.capitulos[c] ? doc.capitulos[c].titulo : "Documento") + "</h4>";
      lista.forEach((n) => {
        html +=
          '<div class="nota nota_' + n.cor + '" data-id="' + n.id + '">' +
          '<span class="nota_tipo">' + ROTULO_TIPO[n.tipo] + " · pág. " + doc.paragrafos[n.p].pg + "</span>" +
          '<p class="nota_texto">“' + esc(n.texto) + "”</p>" +
          (n.comentario ? '<p class="nota_comentario">' + esc(n.comentario) + "</p>" : "") +
          '<div class="linha_botoes"><button class="btn_mini" data-nota-ir="' + n.id + '" type="button">Ir ao trecho</button>' +
          (n.tipo === "comentario" ? '<button class="btn_mini" data-nota-editar="' + n.id + '" type="button">Editar</button>' : "") +
          '<button class="btn_mini" data-nota-apagar="' + n.id + '" type="button">Apagar</button></div></div>';
      });
      html += "</div>";
    });
    alvo.innerHTML = html;
  }

  function ligarNotas() {
    $("#listaNotas").addEventListener("click", (e) => {
      const ir = e.target.closest("[data-nota-ir]");
      const ap = e.target.closest("[data-nota-apagar]");
      const ed = e.target.closest("[data-nota-editar]");
      if (ir) {
        const n = estado.notas.find((x) => x.id === ir.dataset.notaIr);
        if (n) irParaParagrafo(n.p, { centro: true, piscar: true });
      }
      if (ap) {
        const n = estado.notas.find((x) => x.id === ap.dataset.notaApagar);
        estado.notas = estado.notas.filter((x) => x.id !== ap.dataset.notaApagar);
        LD.salvarEstado(doc.id, estado);
        if (n) pintarParagrafo(n.p);
        renderNotas();
      }
      if (ed) {
        const n = estado.notas.find((x) => x.id === ed.dataset.notaEditar);
        const novo = n ? window.prompt("Editar comentário:", n.comentario) : null;
        if (n && novo !== null) {
          n.comentario = novo.trim();
          LD.salvarEstado(doc.id, estado);
          renderNotas();
        }
      }
    });

    $("#btnExportarTxt").addEventListener("click", exportarTxt);
    $("#btnExportarPdf").addEventListener("click", exportarPdf);
  }

  function agruparParaExportar() {
    const grupos = new Map();
    notasOrdenadas().forEach((n) => {
      const c = capituloDe(n.p);
      if (!grupos.has(c)) grupos.set(c, []);
      grupos.get(c).push(n);
    });
    return grupos;
  }

  function exportarTxt() {
    if (!estado.notas.length) {
      aviso("Não há anotações para exportar.");
      return;
    }
    let t = "ANOTAÇÕES — " + doc.titulo + "\nExportado em " + new Date().toLocaleDateString("pt-BR") + "\n";
    agruparParaExportar().forEach((lista, c) => {
      t += "\n=== " + (doc.capitulos[c] ? doc.capitulos[c].titulo : "Documento") + " ===\n";
      lista.forEach((n) => {
        t += "\n[" + ROTULO_TIPO[n.tipo] + " · pág. " + doc.paragrafos[n.p].pg + "]\n“" + n.texto + "”\n";
        if (n.comentario) t += "→ " + n.comentario + "\n";
      });
    });
    baixar(new Blob([t], { type: "text/plain;charset=utf-8" }), "anotacoes-" + nomeArquivo(doc.titulo) + ".txt");
  }

  function exportarPdf() {
    if (!estado.notas.length) {
      aviso("Não há anotações para exportar.");
      return;
    }
    let corpo = "<h1>Anotações</h1><p class=sub>" + esc(doc.titulo) + " · " + new Date().toLocaleDateString("pt-BR") + "</p>";
    agruparParaExportar().forEach((lista, c) => {
      corpo += "<h2>" + esc(doc.capitulos[c] ? doc.capitulos[c].titulo : "Documento") + "</h2>";
      lista.forEach((n) => {
        corpo +=
          '<div class="n"><span class="t">' + ROTULO_TIPO[n.tipo] + " · pág. " + doc.paragrafos[n.p].pg + "</span>" +
          "<blockquote>“" + esc(n.texto) + "”</blockquote>" +
          (n.comentario ? "<p class=c>" + esc(n.comentario) + "</p>" : "") + "</div>";
      });
    });
    const pagina =
      "<!DOCTYPE html><html lang=pt-BR><head><meta charset=utf-8><title>Anotações - " + esc(doc.titulo) + "</title><style>" +
      "body{font-family:Georgia,serif;color:#1b1f27;max-width:720px;margin:32px auto;padding:0 20px;line-height:1.55}" +
      "h1{font-size:26px;margin:0}.sub{color:#6b6355;margin:4px 0 24px}h2{font-size:17px;border-bottom:1px solid #c9bfa6;padding-bottom:4px;margin-top:28px}" +
      ".n{break-inside:avoid;margin:14px 0}.t{font:700 11px sans-serif;text-transform:uppercase;letter-spacing:.05em;color:#c97f1e}" +
      "blockquote{margin:4px 0;padding-left:12px;border-left:3px solid #e2a33b}.c{margin:4px 0 0 15px;color:#444;font-style:italic}" +
      "</style></head><body>" + corpo + "</body></html>";

    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(pagina);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
      aviso("Na janela de impressão, escolha “Salvar como PDF”.", 5000);
    } else {
      baixar(new Blob([pagina], { type: "text/html;charset=utf-8" }), "anotacoes-" + nomeArquivo(doc.titulo) + ".html");
      aviso("Seu navegador bloqueou a janela. Baixei um arquivo HTML: abra-o e imprima como PDF.", 6000);
    }
  }

  function nomeArquivo(t) {
    return LT.dobrar(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "documento";
  }

  function baixar(blob, nome) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ===================================================================
     NARRAÇÃO (TTS)
  =================================================================== */
  const tts = { ativo: false, p: 0, s: 0, token: 0, marca: null, voz: null };
  const cacheSent = new Map();
  const sintese = window.speechSynthesis;
  const suporteTTS = !!(sintese && window.SpeechSynthesisUtterance);

  function sentencasDe(p) {
    if (cacheSent.has(doc.id + ":" + p)) return cacheSent.get(doc.id + ":" + p);
    const texto = doc.paragrafos[p].t;
    const finais = [];
    LT.dividirSentencas(texto).forEach((s) => {
      if (s.fim - s.ini <= 240) {
        finais.push(s);
        return;
      }
      /* frases muito longas: divide em pedaços para a voz não travar */
      const trecho = texto.slice(s.ini, s.fim);
      const re = /[^,;:]+[,;:]?\s*/g;
      let m;
      let ini = s.ini;
      let acc = 0;
      while ((m = re.exec(trecho)) !== null) {
        acc += m[0].length;
        if (acc >= 150) {
          finais.push({ ini: ini, fim: s.ini + re.lastIndex });
          ini = s.ini + re.lastIndex;
          acc = 0;
        }
      }
      if (ini < s.fim) finais.push({ ini: ini, fim: s.fim });
    });
    cacheSent.set(doc.id + ":" + p, finais);
    return finais;
  }

  function carregarVozes() {
    const sel = $("#selVoz");
    if (!suporteTTS) {
      sel.innerHTML = "";
      $("#notaVoz").textContent = "Seu navegador não oferece narração por voz. Experimente Chrome, Edge ou Safari.";
      $("#audioPlay").disabled = true;
      return;
    }
    const todas = sintese.getVoices();
    const pt = todas.filter((v) => /^pt/i.test(v.lang));
    const outras = todas.filter((v) => !/^pt/i.test(v.lang));

    function opcao(v) {
      return '<option value="' + esc(v.voiceURI) + '">' + esc(v.name + " (" + v.lang + ")") + "</option>";
    }
    sel.innerHTML =
      (pt.length ? '<optgroup label="Português">' + pt.map(opcao).join("") + "</optgroup>" : "") +
      (outras.length ? '<optgroup label="Outros idiomas">' + outras.map(opcao).join("") + "</optgroup>" : "");

    let escolhida = todas.find((v) => v.voiceURI === prefs.voz);
    if (!escolhida) escolhida = pt.find((v) => /pt[-_]BR/i.test(v.lang)) || pt[0] || null;
    tts.voz = escolhida;
    if (escolhida) sel.value = escolhida.voiceURI;

    $("#notaVoz").textContent = pt.length
      ? pt.length + " voz(es) em português neste dispositivo."
      : "Nenhuma voz em português foi encontrada. A narração usará a voz padrão do dispositivo, que pode ler com sotaque estrangeiro.";
  }

  function atualizarBarraAudio() {
    const barra = $("#barraAudio");
    barra.classList.toggle("tocando", tts.ativo);
    const total = doc ? doc.paragrafos.length : 0;
    $("#audioPlay").setAttribute("aria-label", tts.ativo ? "Pausar" : "Ouvir");
    $("#audioStatus").textContent = tts.ativo
      ? "Lendo o parágrafo " + (tts.p + 1) + " de " + total
      : estado && (estado.audio.p > 0 || estado.audio.s > 0)
      ? "Pausado no parágrafo " + (estado.audio.p + 1)
      : "Pronto para ouvir";
  }

  function limparMarcaTTS() {
    const antes = tts.marca;
    tts.marca = null;
    if (antes) pintarParagrafo(antes.p);
  }

  function garantirVisivel(el) {
    if (!prefs.acompanharAudio || !el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 150 || r.bottom > window.innerHeight - 150) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function falarAgora() {
    if (!tts.ativo || !doc) return;
    const token = ++tts.token;
    const p = tts.p;
    if (p >= doc.paragrafos.length) {
      pararAudio(false);
      estado.audio = { p: 0, s: 0 };
      LD.salvarEstado(doc.id, estado);
      $("#audioStatus").textContent = "Fim do documento";
      return;
    }
    const sents = sentencasDe(p);
    if (tts.s >= sents.length) {
      tts.p = p + 1;
      tts.s = 0;
      falarAgora();
      return;
    }
    const s = sents[tts.s];
    const texto = doc.paragrafos[p].t.slice(s.ini, s.fim);

    if (tts.marca && tts.marca.p !== p) limparMarcaTTS();
    tts.marca = { p: p, frase: { ini: s.ini, fim: s.fim }, palavra: null };
    pintarParagrafo(p);
    garantirVisivel(parasEl[p].querySelector(".m_frase") || parasEl[p]);

    estado.audio = { p: p, s: tts.s };
    LD.salvarEstado(doc.id, estado);
    atualizarBarraAudio();

    const u = new window.SpeechSynthesisUtterance(texto);
    if (tts.voz) {
      u.voice = tts.voz;
      u.lang = tts.voz.lang;
    } else {
      u.lang = "pt-BR";
    }
    u.rate = prefs.velocidade;

    u.onboundary = (e) => {
      if (token !== tts.token) return;
      if (e.name && e.name !== "word") return;
      let ini = s.ini + e.charIndex;
      let fim = e.charLength ? ini + e.charLength : -1;
      if (fim < 0) {
        const resto = texto.slice(e.charIndex).search(/[\s.,;:!?…]/);
        fim = ini + (resto <= 0 ? texto.length - e.charIndex : resto);
      }
      tts.marca = { p: p, frase: { ini: s.ini, fim: s.fim }, palavra: { ini: ini, fim: fim } };
      pintarParagrafo(p);
    };
    u.onend = () => {
      if (token !== tts.token) return;
      tts.s++;
      falarAgora();
    };
    u.onerror = (e) => {
      if (token !== tts.token) return;
      if (e.error === "interrupted" || e.error === "canceled") return;
      pararAudio(false);
      aviso("A narração parou (" + e.error + "). Tente escolher outra voz.", 4500);
    };

    sintese.cancel();
    setTimeout(() => {
      if (token === tts.token && tts.ativo) sintese.speak(u);
    }, 40);
  }

  function iniciarAudio(p, s) {
    if (!suporteTTS) {
      aviso("Seu navegador não oferece narração por voz.");
      return;
    }
    $("#barraAudio").hidden = false;
    tts.ativo = true;
    tts.p = Math.max(0, Math.min(doc.paragrafos.length - 1, p));
    tts.s = s || 0;
    falarAgora();
  }

  function pararAudio(limparTudo) {
    tts.ativo = false;
    tts.token++;
    if (suporteTTS) sintese.cancel();
    if (tts.marca) {
      if (limparTudo) {
        limparMarcaTTS();
      } else if (tts.marca.palavra) {
        tts.marca.palavra = null;
        pintarParagrafo(tts.marca.p);
      }
    }
    if (doc) atualizarBarraAudio();
  }

  function alternarAudio() {
    if (tts.ativo) {
      pararAudio(false);
      return;
    }
    const salvo = estado.audio;
    if (salvo && (salvo.p > 0 || salvo.s > 0)) {
      aviso("Retomando do parágrafo " + (salvo.p + 1) + "…", 1800);
      irParaParagrafo(salvo.p, { centro: true });
      iniciarAudio(salvo.p, salvo.s);
    } else {
      iniciarAudio(atual, 0);
    }
  }

  function pularParagrafo(delta) {
    const base = tts.ativo ? tts.p : estado.audio.p || atual;
    const novo = Math.max(0, Math.min(doc.paragrafos.length - 1, base + delta));
    if (tts.ativo) {
      iniciarAudio(novo, 0);
    } else {
      estado.audio = { p: novo, s: 0 };
      LD.salvarEstado(doc.id, estado);
      irParaParagrafo(novo, { centro: true });
      atualizarBarraAudio();
    }
  }

  function reiniciarFraseAtual() {
    if (tts.ativo) falarAgora();
  }

  function ligarAudio() {
    if (suporteTTS) {
      carregarVozes();
      if (sintese.onvoiceschanged !== undefined) sintese.onvoiceschanged = carregarVozes;
    } else {
      carregarVozes();
    }

    $("#audioPlay").addEventListener("click", alternarAudio);
    $("#audioAnterior").addEventListener("click", () => pularParagrafo(-1));
    $("#audioProximo").addEventListener("click", () => pularParagrafo(1));
    $("#audioFechar").addEventListener("click", () => {
      pararAudio(false);
      $("#barraAudio").hidden = true;
    });

    $("#audioVelocidade").addEventListener("change", (e) => {
      mudarPref("velocidade", Number(e.target.value));
      reiniciarFraseAtual();
    });
    $("#rngVelocidade").addEventListener("input", (e) => {
      mudarPref("velocidade", Number(e.target.value));
    });
    $("#rngVelocidade").addEventListener("change", reiniciarFraseAtual);

    $("#selVoz").addEventListener("change", (e) => {
      const v = sintese.getVoices().find((x) => x.voiceURI === e.target.value);
      tts.voz = v || null;
      prefs.voz = e.target.value;
      LD.salvarPrefs(prefs);
      reiniciarFraseAtual();
    });

    $("#btnOuvirDaqui").addEventListener("click", () => iniciarAudio(atual, 0));
    $("#btnRetomarAudio").addEventListener("click", () => {
      irParaParagrafo(estado.audio.p, { centro: true });
      iniciarAudio(estado.audio.p, estado.audio.s);
    });
  }

  /* ===================================================================
     ASSISTENTE: busca, perguntas e resumo (locais)
  =================================================================== */
  function preencherSelecoes() {
    const opcoes = doc.capitulos.map((c, i) => '<option value="' + i + '">' + esc(c.titulo.length > 70 ? c.titulo.slice(0, 67) + "…" : c.titulo) + "</option>").join("");
    $("#selResumo").innerHTML = opcoes;
    $("#selEscopo").innerHTML = '<option value="tudo">Documento inteiro</option>' + opcoes;
    $("#resultadosBusca").innerHTML = "";
    $("#resultadosPergunta").innerHTML = "";
    $("#resultadoResumo").innerHTML = "";
    $("#navBusca").hidden = true;
    $("#areaEstudo").innerHTML = "";
  }

  function trecho(texto, ini, fim, folga) {
    const a = Math.max(0, ini - folga);
    const b = Math.min(texto.length, fim + folga);
    return (a > 0 ? "…" : "") + esc(texto.slice(a, ini)) + "<mark>" + esc(texto.slice(ini, fim)) + "</mark>" + esc(texto.slice(fim, b)) + (b < texto.length ? "…" : "");
  }

  function limparBuscaVisual() {
    const afetados = Array.from(busca.porPar.keys());
    busca = { termo: "", achados: [], atual: -1, porPar: new Map() };
    afetados.forEach(pintarParagrafo);
  }

  function marcarBusca() {
    const antes = Array.from(busca.porPar.keys());
    busca.porPar = new Map();
    busca.achados.forEach((a, k) => {
      if (!busca.porPar.has(a.p)) busca.porPar.set(a.p, []);
      busca.porPar.get(a.p).push({ ini: a.ini, fim: a.fim, atual: k === busca.atual });
    });
    new Set(antes.concat(Array.from(busca.porPar.keys()))).forEach(pintarParagrafo);
  }

  function irParaAchado(k) {
    if (!busca.achados.length) return;
    busca.atual = (k + busca.achados.length) % busca.achados.length;
    marcarBusca();
    $("#contBusca").textContent = busca.atual + 1 + " de " + busca.achados.length;
    const el = parasEl[busca.achados[busca.atual].p].querySelector(".m_busca_atual");
    (el || parasEl[busca.achados[busca.atual].p]).scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function fazerBusca() {
    const termo = $("#inpBusca").value.trim();
    limparBuscaVisual();
    if (termo.length < 2) {
      $("#resultadosBusca").innerHTML = '<p class="campo_nota">Digite ao menos 2 letras.</p>';
      $("#navBusca").hidden = true;
      return;
    }
    const achados = LT.buscar(doc.paragrafos, indice, termo, 1500);
    busca.termo = termo;
    busca.achados = achados;
    busca.atual = achados.length ? 0 : -1;

    if (!achados.length) {
      $("#resultadosBusca").innerHTML = '<p class="campo_nota">Nada encontrado para “' + esc(termo) + "”.</p>";
      $("#navBusca").hidden = true;
      return;
    }
    $("#navBusca").hidden = false;
    $("#resultadosBusca").innerHTML = achados
      .slice(0, 40)
      .map((a, k) => {
        const par = doc.paragrafos[a.p];
        return '<button type="button" class="resultado" data-achado="' + k + '"><small>' + esc(doc.capitulos[capituloDe(a.p)].titulo.slice(0, 40)) + " · pág. " + par.pg + "</small>" + trecho(par.t, a.ini, a.fim, 50) + "</button>";
      })
      .join("") + (achados.length > 40 ? '<p class="campo_nota">Mostrando 40 de ' + achados.length + " ocorrências. Use as setas para percorrer todas.</p>" : "");
    irParaAchado(0);
  }

  function fazerPergunta() {
    const q = $("#inpPergunta").value.trim();
    const alvo = $("#resultadosPergunta");
    if (q.length < 3) {
      alvo.innerHTML = '<p class="campo_nota">Escreva uma pergunta ou algumas palavras-chave.</p>';
      return;
    }
    const r = LT.perguntar(doc.paragrafos, indice, q, 5);
    if (!r.resultados.length) {
      alvo.innerHTML = '<p class="campo_nota">Não encontrei trechos relacionados. Tente outras palavras.</p>';
      return;
    }
    alvo.innerHTML = r.resultados
      .map((x) => {
        const par = doc.paragrafos[x.p];
        const sents = LT.dividirSentencas(par.t);
        let melhor = sents[0];
        let nota = -1;
        sents.forEach((s) => {
          const ts = LT.tokens(par.t.slice(s.ini, s.fim)).map(LT.radical);
          const n = r.termos.filter((t) => ts.indexOf(t) >= 0).length;
          if (n > nota) {
            nota = n;
            melhor = s;
          }
        });
        let frase = esc(par.t.slice(melhor.ini, melhor.fim));
        if (frase.length > 320) frase = frase.slice(0, 317) + "…";
        return '<button type="button" class="resultado" data-ir-par="' + x.p + '"><small>' + esc(doc.capitulos[capituloDe(x.p)].titulo.slice(0, 40)) + " · pág. " + par.pg + "</small>" + frase + "</button>";
      })
      .join("");
  }

  function fazerResumo() {
    const c = doc.capitulos[Number($("#selResumo").value)];
    const alvo = $("#resultadoResumo");
    const frases = LT.resumirCapitulo(doc.paragrafos, indice, c);
    if (!frases.length) {
      alvo.innerHTML = '<p class="campo_nota">Esta seção é curta demais para gerar um resumo.</p>';
      return;
    }
    alvo.innerHTML = frases
      .map((f) => '<button type="button" class="resultado" data-ir-par="' + f.p + '">' + esc(f.texto) + "</button>")
      .join("");
  }

  function ligarAssistente() {
    $("#btnBuscar").addEventListener("click", fazerBusca);
    $("#inpBusca").addEventListener("keydown", (e) => {
      if (e.key === "Enter") fazerBusca();
    });
    $("#btnBuscaProx").addEventListener("click", () => irParaAchado(busca.atual + 1));
    $("#btnBuscaAnt").addEventListener("click", () => irParaAchado(busca.atual - 1));
    $("#btnBuscaLimpar").addEventListener("click", () => {
      limparBuscaVisual();
      $("#resultadosBusca").innerHTML = "";
      $("#navBusca").hidden = true;
      $("#inpBusca").value = "";
    });
    $("#resultadosBusca").addEventListener("click", (e) => {
      const b = e.target.closest("[data-achado]");
      if (b) irParaAchado(Number(b.dataset.achado));
    });

    $("#btnPerguntar").addEventListener("click", fazerPergunta);
    $("#inpPergunta").addEventListener("keydown", (e) => {
      if (e.key === "Enter") fazerPergunta();
    });
    $("#btnResumir").addEventListener("click", fazerResumo);

    [$("#resultadosPergunta"), $("#resultadoResumo")].forEach((alvo) =>
      alvo.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ir-par]");
        if (b) irParaParagrafo(Number(b.dataset.irPar), { centro: true, piscar: true });
      })
    );
  }

  /* ===================================================================
     APRENDIZAGEM ATIVA
  =================================================================== */
  function intervaloEscopo() {
    const v = $("#selEscopo").value;
    if (v === "tudo") return [0, doc.paragrafos.length - 1];
    const c = doc.capitulos[Number(v)];
    return [c.inicio, c.fim];
  }

  function gerarSessao() {
    const [de, ate] = intervaloEscopo();
    const qtd = Number($("#selQtd").value);
    return LT.gerarQuestoes(doc.paragrafos, de, ate, qtd, (Date.now() / 1000) | 0);
  }

  function registrarResposta(q, acertou) {
    const i = estado.revisar.findIndex((r) => r.frase === q.frase);
    if (!acertou) {
      if (i < 0) estado.revisar.push({ frase: q.frase, lacuna: q.lacuna, resposta: q.resposta, p: q.p, c: q.c, erros: 1 });
      else estado.revisar[i].erros++;
    } else if (i >= 0) {
      estado.revisar.splice(i, 1);
    }
    LD.salvarEstado(doc.id, estado);
    atualizarNotaRevisar();
  }

  function atualizarNotaRevisar() {
    const n = estado ? estado.revisar.length : 0;
    $("#notaRevisar").textContent = n
      ? n + " item(ns) aguardando revisão. Eles saem da lista quando você acerta."
      : "Nenhuma pendência de revisão por enquanto.";
    $("#btnRevisar").disabled = !n;
  }

  function lacunaHtml(l) {
    return esc(l).replace("_____", "<strong>_____</strong>");
  }

  function mostrarFlashcards(itens, titulo) {
    sessaoEstudo = { tipo: "flash", itens: itens, i: 0, erros: [], acertos: 0, titulo: titulo };
    renderFlash();
  }

  function renderFlash(verso) {
    const s = sessaoEstudo;
    const alvo = $("#areaEstudo");
    if (s.i >= s.itens.length) return renderResultado();
    const q = s.itens[s.i];
    alvo.innerHTML =
      '<div class="estudo_topo"><span>' + esc(s.titulo) + " · " + (s.i + 1) + " de " + s.itens.length + "</span></div>" +
      '<div class="flash"><div class="flash_carta' + (verso ? " verso" : "") + '" id="cartaFlash" tabindex="0" role="button" aria-label="Virar cartão">' +
      (verso ? esc(q.lacuna).replace("_____", "<strong>" + esc(q.resposta) + "</strong>") : lacunaHtml(q.lacuna)) +
      "</div></div>" +
      '<p class="campo_nota">' + (verso ? "Você acertou a palavra escondida?" : "Pense na palavra que falta e toque no cartão.") + "</p>" +
      (verso
        ? '<div class="linha_botoes"><button class="btn_primario" id="flashAcertei" type="button">Acertei</button><button class="btn_secundario" id="flashErrei" type="button">Errei</button></div>'
        : '<div class="linha_botoes"><button class="btn_secundario" id="flashVirar" type="button">Mostrar resposta</button></div>');

    const virar = () => renderFlash(true);
    const carta = $("#cartaFlash");
    carta.addEventListener("click", () => !verso && virar());
    carta.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && !verso) {
        e.preventDefault();
        virar();
      }
    });
    if (!verso) $("#flashVirar").addEventListener("click", virar);
    else {
      $("#flashAcertei").addEventListener("click", () => responderFlash(true));
      $("#flashErrei").addEventListener("click", () => responderFlash(false));
    }
  }

  function responderFlash(acertou) {
    const s = sessaoEstudo;
    const q = s.itens[s.i];
    registrarResposta(q, acertou);
    if (acertou) s.acertos++;
    else s.erros.push(q);
    s.i++;
    renderFlash();
  }

  function mostrarQuiz(itens) {
    sessaoEstudo = { tipo: "quiz", itens: itens, i: 0, erros: [], acertos: 0, titulo: "Questionário" };
    renderQuiz();
  }

  function renderQuiz() {
    const s = sessaoEstudo;
    const alvo = $("#areaEstudo");
    if (s.i >= s.itens.length) return renderResultado();
    const q = s.itens[s.i];
    alvo.innerHTML =
      '<div class="estudo_topo"><span>Questão ' + (s.i + 1) + " de " + s.itens.length + "</span><span>" + s.acertos + " acerto(s)</span></div>" +
      '<p class="campo_nota">Escolha a palavra que completa a frase.</p>' +
      '<div class="quiz_frase">' + lacunaHtml(q.lacuna) + "</div>" +
      '<div class="quiz_opcoes">' +
      q.opcoes.map((o, k) => '<button class="quiz_opcao" data-op="' + k + '" type="button">' + esc(o) + "</button>").join("") +
      '</div><div id="quizAcoes"></div>';

    $$(".quiz_opcao").forEach((b) =>
      b.addEventListener("click", () => {
        const escolhida = q.opcoes[Number(b.dataset.op)];
        const acertou = escolhida === q.resposta;
        $$(".quiz_opcao").forEach((x) => {
          x.disabled = true;
          if (q.opcoes[Number(x.dataset.op)] === q.resposta) x.classList.add("certa");
        });
        if (!acertou) b.classList.add("errada");
        registrarResposta(q, acertou);
        if (acertou) s.acertos++;
        else s.erros.push(q);
        $("#quizAcoes").innerHTML =
          '<p class="campo_nota">' + (acertou ? "Correto!" : "A resposta certa era <strong>" + esc(q.resposta) + "</strong>.") + "</p>" +
          '<div class="linha_botoes"><button class="btn_primario" id="quizProxima" type="button">' + (s.i + 1 >= s.itens.length ? "Ver resultado" : "Próxima") + "</button></div>";
        $("#quizProxima").addEventListener("click", () => {
          s.i++;
          renderQuiz();
        });
        $("#quizProxima").focus();
      })
    );
  }

  function renderResultado() {
    const s = sessaoEstudo;
    const total = s.itens.length;
    const pct = Math.round((s.acertos / total) * 100);
    const porCap = new Map();
    s.erros.forEach((q) => porCap.set(q.c, (porCap.get(q.c) || 0) + 1));
    const revisar = Array.from(porCap.entries()).sort((a, b) => b[1] - a[1]);

    $("#areaEstudo").innerHTML =
      '<div class="resultado_final"><strong>' + s.acertos + " / " + total + " (" + pct + "%)</strong>" +
      "<span>" + (pct >= 80 ? "Ótima compreensão!" : pct >= 50 ? "Bom caminho. Vale revisar alguns pontos." : "Vale reler o conteúdo e tentar de novo.") + "</span>" +
      (revisar.length
        ? '<p class="campo_nota" style="margin-top:10px">Assuntos para revisar:</p><ul>' +
          revisar.map(([c, n]) => "<li><a href=\"#\" data-ir-cap=\"" + doc.capitulos[c].inicio + "\">" + esc(doc.capitulos[c].titulo.slice(0, 60)) + "</a> (" + n + " erro" + (n > 1 ? "s" : "") + ")</li>").join("") + "</ul>"
        : "") +
      "</div>" +
      '<div class="linha_botoes">' +
      (s.erros.length ? '<button class="btn_primario" id="refazerErros" type="button">Refazer os erros</button>' : "") +
      '<button class="btn_secundario" id="novaSessao" type="button">Nova sessão</button></div>';

    $$("[data-ir-cap]").forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        irParaParagrafo(Number(a.dataset.irCap));
      })
    );
    const refazer = $("#refazerErros");
    if (refazer) refazer.addEventListener("click", () => (s.tipo === "quiz" ? mostrarQuiz(s.erros) : mostrarFlashcards(s.erros, "Refazendo erros")));
    $("#novaSessao").addEventListener("click", () => {
      $("#areaEstudo").innerHTML = "";
      sessaoEstudo = null;
    });
  }

  function ligarEstudo() {
    $("#btnFlashcards").addEventListener("click", () => {
      const q = gerarSessao();
      if (!q.length) return semQuestoes();
      mostrarFlashcards(q, "Flashcards");
    });
    $("#btnQuiz").addEventListener("click", () => {
      const q = gerarSessao();
      if (!q.length) return semQuestoes();
      mostrarQuiz(q.filter((x) => x.opcoes.length >= 3));
    });
    $("#btnRevisar").addEventListener("click", () => {
      if (!estado.revisar.length) return;
      mostrarFlashcards(estado.revisar.slice(), "Revisão");
    });
  }

  function semQuestoes() {
    $("#areaEstudo").innerHTML = '<p class="campo_nota">Não encontrei frases adequadas neste trecho. Tente escolher um conteúdo maior, como o documento inteiro.</p>';
  }

  /* ===================================================================
     ACOMPANHAMENTO
  =================================================================== */
  function renderProgresso() {
    const dias = LD.carregarDias();
    const hojeSeg = dias[LD.hoje()] || 0;
    const metaSeg = prefs.metaMinutos * 60;
    const pctMeta = Math.min(100, Math.round((hojeSeg / Math.max(1, metaSeg)) * 100));

    const total = doc.paragrafos.length;
    const pctDoc = Math.round(((estado.maximo + 1) / total) * 100);
    let palavras = 0;
    for (let i = 0; i <= estado.maximo; i++) palavras += LT.contarPalavras(doc.paragrafos[i].t);
    const ritmo = estado.segundos >= 120 ? Math.round(palavras / (estado.segundos / 60)) : null;

    const semana = [];
    for (let k = 6; k >= 0; k--) {
      const d = new Date();
      d.setDate(d.getDate() - k);
      semana.push({ rotulo: ["D", "S", "T", "Q", "Q", "S", "S"][d.getDay()], seg: dias[chaveData(d)] || 0 });
    }
    const maior = Math.max(metaSeg, ...semana.map((s) => s.seg), 1);

    const porCap = new Map();
    estado.revisar.forEach((r) => porCap.set(r.c, (porCap.get(r.c) || 0) + 1));
    const rev = Array.from(porCap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    $("#painelProgresso").innerHTML =
      '<div class="campo"><span class="campo_rotulo">Meta de hoje</span>' +
      '<div class="anel" style="--pct:' + pctMeta + '"><div>' + pctMeta + "%<small>" + minutos(hojeSeg) + "</small></div></div>" +
      '<div class="meta_linha"><label for="inpMeta" class="campo_nota">Meta diária (min)</label><input id="inpMeta" class="entrada" type="number" min="1" max="600" value="' + prefs.metaMinutos + '"></div>' +
      '<p class="campo_nota">Sequência: ' + sequencia(dias, metaSeg) + " dia(s) seguidos cumprindo a meta.</p></div>" +
      '<div class="campo"><span class="campo_rotulo">Últimos 7 dias</span><div class="grafico">' +
      semana.map((s) => '<div title="' + minutos(s.seg) + '"><span style="height:' + Math.round((s.seg / maior) * 100) + '%"></span>' + s.rotulo + "</div>").join("") +
      "</div></div>" +
      '<div class="campo"><span class="campo_rotulo">Este documento</span><div class="grade_numeros">' +
      '<div class="cartao_num"><strong>' + pctDoc + "%</strong><span>lido</span></div>" +
      '<div class="cartao_num"><strong>' + minutos(estado.segundos) + "</strong><span>de leitura</span></div>" +
      '<div class="cartao_num"><strong>' + palavras.toLocaleString("pt-BR") + "</strong><span>palavras lidas</span></div>" +
      '<div class="cartao_num"><strong>' + (ritmo ? ritmo : "—") + "</strong><span>palavras por minuto</span></div></div></div>" +
      '<div class="campo"><span class="campo_rotulo">Anotações e estudo</span>' +
      '<p class="campo_nota">' + estado.notas.length + " anotação(ões) · " + estado.revisar.length + " item(ns) para revisar</p>" +
      (rev.length
        ? "<ul class=\"campo_nota\">" + rev.map(([c, n]) => "<li>" + esc(doc.capitulos[c].titulo.slice(0, 50)) + ": " + n + "</li>").join("") + "</ul>"
        : "") +
      "</div>";

    $("#inpMeta").addEventListener("change", (e) => {
      const v = Math.max(1, Math.min(600, Number(e.target.value) || 20));
      mudarPref("metaMinutos", v);
      renderProgresso();
    });
  }

  function iniciarContagemTempo() {
    pararContagemTempo();
    ultimaAtividade = Date.now();
    intervaloTempo = setInterval(() => {
      if (!doc || document.hidden) return;
      const ativo = Date.now() - ultimaAtividade < 60000 || tts.ativo;
      if (!ativo) return;
      estado.segundos++;
      segundosPendentes++;
      if (segundosPendentes >= 5) salvarTudo();
      if (abaAtual === "progresso" && estado.segundos % 15 === 0) renderProgresso();
    }, 1000);
  }

  function pararContagemTempo() {
    if (intervaloTempo) clearInterval(intervaloTempo);
    intervaloTempo = null;
  }

  function salvarTudo() {
    if (!doc) return;
    if (segundosPendentes > 0) {
      LD.somarTempo(segundosPendentes);
      segundosPendentes = 0;
    }
    LD.salvarEstado(doc.id, estado);
    LD.atualizarIndice({
      id: doc.id,
      ultimoAcesso: Date.now(),
      progresso: (estado.maximo + 1) / doc.paragrafos.length,
      segundos: estado.segundos
    });
  }

  /* ===================================================================
     PAINÉIS, MODO FOCO E EVENTOS GERAIS
  =================================================================== */
  function abrirAba(nome) {
    abaAtual = nome;
    painel.hidden = false;
    layout.classList.add("com_direita");
    $$(".aba", painel).forEach((a) => (a.hidden = a.dataset.aba !== nome));
    $$(".aba_btn").forEach((b) => b.classList.toggle("ativa", b.dataset.aba === nome));
    if (nome === "notas") renderNotas();
    if (nome === "progresso") renderProgresso();
    if (nome === "estudo") {
      const c = capituloDe(atual);
      if ($("#selEscopo").querySelector('option[value="' + c + '"]')) $("#selEscopo").value = String(c);
      atualizarNotaRevisar();
    }
    if (nome === "assistente") $("#selResumo").value = String(capituloDe(atual));
  }

  function fecharPainelFerramentas() {
    abaAtual = null;
    painel.hidden = true;
    layout.classList.remove("com_direita");
    $$(".aba_btn").forEach((b) => b.classList.remove("ativa"));
  }

  function entrarFoco() {
    document.body.classList.add("foco");
    $("#sairFoco").hidden = false;
    esconderBarraSelecao();
  }

  function sairFoco() {
    document.body.classList.remove("foco");
    $("#sairFoco").hidden = true;
  }

  function ligarGeral() {
    $$(".aba_btn").forEach((b) =>
      b.addEventListener("click", () => {
        if (abaAtual === b.dataset.aba) fecharPainelFerramentas();
        else abrirAba(b.dataset.aba);
      })
    );
    $("#fecharFerramentas").addEventListener("click", fecharPainelFerramentas);
    $("#btnCapitulos").addEventListener("click", () => layout.classList.toggle("sem_esquerda"));
    $("#btnVoltarLista").addEventListener("click", voltarParaLista);
    $("#btnFoco").addEventListener("click", entrarFoco);
    $("#sairFoco").addEventListener("click", sairFoco);

    $("#listaCapitulos").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ir]");
      if (!b) return;
      irParaParagrafo(Number(b.dataset.ir));
      if (window.innerWidth <= 900) layout.classList.add("sem_esquerda");
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (document.body.classList.contains("foco")) sairFoco();
        else if (!barraSel.hidden) esconderBarraSelecao();
      }
    });

    ["scroll", "mousemove", "keydown", "touchstart", "click"].forEach((ev) =>
      window.addEventListener(ev, () => (ultimaAtividade = Date.now()), { passive: true })
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) salvarTudo();
    });
    window.addEventListener("pagehide", salvarTudo);
  }

  /* ---------- início ---------- */
  aplicarPrefs();
  ligarAparencia();
  ligarInicio();
  ligarSelecao();
  ligarNotas();
  ligarAssistente();
  ligarEstudo();
  ligarAudio();
  ligarGeral();
  renderInicio();
})();
