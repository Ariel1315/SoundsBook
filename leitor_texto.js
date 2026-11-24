/* ===================================================================
   SoundsBook — leitor de PDF: extração e análise de texto
   Tudo roda no navegador do usuário (sem servidor, sem IA externa).
   Funciona no site (window.LeitorTexto) e no Node (para testes).
=================================================================== */
(function (raiz) {
  "use strict";

  /* ---------- utilidades ---------- */
  const STOP = new Set(
    ("a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sob sobre entre ate e ou mas que se " +
      "como quando onde porque pois porem contudo todavia entao assim ja mais menos muito muita muitos muitas pouco " +
      "tao tambem ainda so apenas mesmo mesma eu tu ele ela nos vos eles elas me te lhe lhes meu minha meus minhas " +
      "teu tua teus tuas seu sua seus suas nosso nossa este esta estes estas esse essa esses essas isto isso aquilo " +
      "aquele aquela aqueles aquelas qual quais quem cujo cuja ser e sao era eram foi foram fui seja sejam estar " +
      "esta estao estava estavam tinha tinham ter tem tem ha havia haver fazer faz fez pode podem poder deve devem " +
      "dever ao aos as pelo pela pelos pelas num numa nuns numas dele dela deles delas aqui ali la ca nada tudo todo " +
      "toda todos todas cada outro outra outros outras qualquer vez vezes sim nao nem sao disse diz dizer ate " +
      "depois antes entao ainda sempre nunca ja onde alem apos sobre sendo ser tendo quer querer ir vai vou").split(" ")
  );

  /* remove acentos sem mudar o tamanho do texto (importante para offsets) */
  function dobrar(texto) {
    let saida = "";
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (c.charCodeAt(0) < 128) {
        saida += c;
      } else {
        const base = c.normalize("NFD").charAt(0);
        saida += base.charCodeAt(0) < 128 ? base : c;
      }
    }
    return saida;
  }

  function tokens(texto) {
    return dobrar(texto).toLowerCase().match(/[a-z0-9]+/g) || [];
  }

  function radical(p) {
    return p.length > 5 ? p.slice(0, 5) : p;
  }

  function contarPalavras(texto) {
    const m = texto.match(/\S+/g);
    return m ? m.length : 0;
  }

  function mediana(lista) {
    if (!lista.length) return 0;
    const o = lista.slice().sort((a, b) => a - b);
    return o[Math.floor(o.length / 2)];
  }

  function percentil(lista, p) {
    if (!lista.length) return 0;
    const o = lista.slice().sort((a, b) => a - b);
    return o[Math.min(o.length - 1, Math.floor(o.length * p))];
  }

  function gerador(semente) {
    let a = semente >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function embaralhar(lista, rnd) {
    const r = lista.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }

  /* ---------- extração do PDF ---------- */
  async function linhasDaPagina(pagina) {
    const conteudo = await pagina.getTextContent();
    const linhas = [];
    let atual = null;

    function fechar() {
      if (atual && atual.texto.trim()) linhas.push(atual);
      atual = null;
    }

    for (const it of conteudo.items) {
      if (typeof it.str !== "string") continue;
      const x = it.transform[4];
      const y = it.transform[5];
      const h = Math.abs(it.transform[3]) || it.height || 10;

      if (!atual || Math.abs(y - atual.y) > h * 0.5) {
        fechar();
        atual = { texto: "", x: x, y: y, h: h, fim: x };
      }

      if (atual.texto && !/\s$/.test(atual.texto) && !/^\s/.test(it.str)) {
        if (x - atual.fim > h * 0.12) atual.texto += " ";
      }

      atual.texto += it.str;
      atual.fim = x + (it.width || 0);

      if (it.hasEOL) fechar();
    }
    fechar();

    return linhas
      .map((l) => ({ texto: l.texto.replace(/\s+/g, " ").trim(), x: l.x, y: l.y, h: l.h, fim: l.fim }))
      .filter((l) => l.texto);
  }

  const RE_CAP = /^(cap[ií]tulo|livro|parte|se[cç][aã]o|pr[oó]logo|ep[ií]logo|pref[aá]cio|introdu[cç][aã]o|conclus[aã]o|ap[eê]ndice)\b/i;
  const RE_ROMANO = /^[IVXLCDM]{1,8}[.)]?$/;
  const RE_NUM = /^\d{1,3}[.)]\s+\S/;

  function tudoMaiusculo(t) {
    const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
    return letras.length >= 4 && letras === letras.toUpperCase();
  }

  function pareceTitulo(t) {
    if (!t || t.length > 110) return false;
    if (RE_CAP.test(t) && t.length <= 100 && !/[.!?]$/.test(t)) return true;
    if (RE_ROMANO.test(t)) return true;
    if (RE_NUM.test(t) && !/[.!?]$/.test(t)) return true;
    if (tudoMaiusculo(t) && t.length <= 70 && !/[.!?]$/.test(t)) return true;
    return false;
  }

  function tituloDeLinha(texto, h, hMed) {
    if (!pareceTitulo(texto)) return false;
    if (RE_NUM.test(texto) && !RE_CAP.test(texto)) return h > hMed * 1.08;
    return true;
  }

  function montarParagrafos(paginas) {
    /* remove números de página e cabeçalhos/rodapés repetidos */
    const norm = (s) => s.replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
    const contagem = new Map();
    paginas.forEach((p) => {
      [p.linhas[0], p.linhas[p.linhas.length - 1]].forEach((l) => {
        if (!l) return;
        const k = norm(l.texto);
        contagem.set(k, (contagem.get(k) || 0) + 1);
      });
    });
    const limite = Math.max(3, Math.floor(paginas.length * 0.25));
    const repetidos = new Set();
    contagem.forEach((v, k) => {
      if (v >= limite && k.length < 90) repetidos.add(k);
    });

    paginas.forEach((p) => {
      p.linhas = p.linhas.filter((l, i) => {
        const extremo = i === 0 || i === p.linhas.length - 1;
        if (!extremo) return true;
        if (/^\d{1,4}$/.test(l.texto)) return false;
        return !repetidos.has(norm(l.texto));
      });
    });

    const paragrafos = [];
    let atual = null;

    function fechar() {
      if (atual && atual.t.trim()) paragrafos.push({ t: atual.t.trim(), pg: atual.pg });
      atual = null;
    }

    function anexar(texto, pg) {
      if (!atual) {
        atual = { t: texto, pg: pg };
        return;
      }
      if (/[A-Za-zÀ-ÿ]-$/.test(atual.t) && /^[a-zà-ÿ]/.test(texto)) {
        atual.t = atual.t.slice(0, -1) + texto;
      } else {
        atual.t += " " + texto;
      }
    }

    paginas.forEach((p) => {
      const linhas = p.linhas;
      if (!linhas.length) return;

      const difs = [];
      for (let i = 1; i < linhas.length; i++) {
        const d = linhas[i - 1].y - linhas[i].y;
        if (d > 0) difs.push(d);
      }
      const espaco = mediana(difs) || 14;
      const margem = percentil(linhas.map((l) => l.x), 0.15);
      const largura = mediana(linhas.map((l) => l.fim - l.x)) || 300;
      const hMed = mediana(linhas.map((l) => l.h)) || 10;

      linhas.forEach((l, i) => {
        const anterior = i > 0 ? linhas[i - 1] : null;
        const titulo = tituloDeLinha(l.texto, l.h, hMed);
        let quebra = false;

        if (!anterior) {
          /* início de página: continua o parágrafo se ele ainda não terminou */
          quebra = !atual || /[.!?…:"”»)]$/.test(atual.t) || titulo;
        } else {
          const gap = anterior.y - l.y;
          const recuo = l.x - margem > l.h * 1.2;
          const fimFrase = /[.!?…:"”»)]\s*$/.test(anterior.texto);
          const curta = anterior.fim - anterior.x < largura * 0.7;
          quebra =
            gap > espaco * 1.45 ||
            (fimFrase && (recuo || curta)) ||
            titulo ||
            tituloDeLinha(anterior.texto, anterior.h, hMed);
        }

        if (quebra) fechar();
        anexar(l.texto, p.num);
      });
    });
    fechar();
    return paragrafos;
  }

  async function extrairParagrafos(pdf, aoProgredir) {
    const paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pagina = await pdf.getPage(n);
      paginas.push({ num: n, linhas: await linhasDaPagina(pagina) });
      if (aoProgredir) aoProgredir(n, pdf.numPages);
    }
    const paragrafos = montarParagrafos(paginas);
    return { paragrafos: paragrafos, paginas: pdf.numPages };
  }

  /* ---------- capítulos ---------- */
  function detectarCapitulos(paragrafos, totalPaginas) {
    const candidato = paragrafos.map((p) => pareceTitulo(p.t));

    /* sumário: muitos "títulos" juntos (em janela de 13 parágrafos) não são capítulos */
    const ruido = new Array(candidato.length).fill(false);
    for (let i = 0; i < candidato.length; i++) {
      if (!candidato[i]) continue;
      let vizinhos = 0;
      for (let k = Math.max(0, i - 6); k <= Math.min(candidato.length - 1, i + 6); k++) {
        if (candidato[k]) vizinhos++;
      }
      if (vizinhos >= 6) ruido[i] = true;
    }
    for (let i = 0; i < candidato.length; i++) if (ruido[i]) candidato[i] = false;

    /* "CAPÍTULO I" sozinho + linha curta seguinte = título completo */
    const complemento = new Set();
    for (let i = 0; i + 1 < paragrafos.length; i++) {
      if (!candidato[i] || candidato[i + 1]) continue;
      const t = paragrafos[i].t;
      const prox = paragrafos[i + 1].t;
      if (/^(cap[ií]tulo\s+\S+|[IVXLCDM]{1,8}[.)]?)$/i.test(t) && prox.length < 100 && !/[.!?]$/.test(prox)) {
        complemento.add(i + 1);
      }
    }

    const repeticoes = new Map();
    candidato.forEach((c, idx) => {
      if (!c) return;
      const k = paragrafos[idx].t.toLowerCase();
      repeticoes.set(k, (repeticoes.get(k) || 0) + 1);
    });

    const marcas = [];
    candidato.forEach((c, idx) => {
      if (!c) return;
      const t = paragrafos[idx].t;
      if (repeticoes.get(t.toLowerCase()) >= 6 && !RE_CAP.test(t) && !RE_ROMANO.test(t)) {
        paragrafos[idx].h = true;
        return;
      }
      marcas.push(idx);
    });

    const capitulos = [];
    if (marcas.length >= 2) {
      if (marcas[0] > 2) capitulos.push({ titulo: "Início", inicio: 0 });
      let k = 0;
      while (k < marcas.length) {
        let fimBloco = k;
        while (fimBloco + 1 < marcas.length && marcas[fimBloco + 1] === marcas[fimBloco] + 1) fimBloco++;
        const titulo = marcas
          .slice(k, fimBloco + 1)
          .map((m) => paragrafos[m].t)
          .join(" · ");
        capitulos.push({ titulo: titulo.length > 120 ? titulo.slice(0, 117) + "…" : titulo, inicio: marcas[k] });
        for (let m = k; m <= fimBloco; m++) paragrafos[marcas[m]].h = true;
        const ultimo = marcas[fimBloco];
        if (complemento.has(ultimo + 1)) {
          paragrafos[ultimo + 1].h = true;
          capitulos[capitulos.length - 1].titulo += " · " + paragrafos[ultimo + 1].t;
        }
        k = fimBloco + 1;
      }
    } else {
      const porSecao = Math.max(1, Math.ceil(totalPaginas / Math.max(1, Math.ceil(totalPaginas / 10))));
      let ultimaSecao = -1;
      paragrafos.forEach((p, idx) => {
        const s = Math.floor((p.pg - 1) / porSecao);
        if (s !== ultimaSecao) {
          ultimaSecao = s;
          const a = s * porSecao + 1;
          const b = Math.min(totalPaginas, (s + 1) * porSecao);
          capitulos.push({ titulo: "Páginas " + a + "–" + b, inicio: idx });
        }
      });
    }

    capitulos.forEach((c, idx) => {
      c.fim = idx + 1 < capitulos.length ? capitulos[idx + 1].inicio - 1 : paragrafos.length - 1;
      for (let p = c.inicio; p <= c.fim; p++) paragrafos[p].c = idx;
    });

    return capitulos;
  }

  /* ---------- frases ---------- */
  const RE_ABREV = /\b(Sr|Sra|Srta|Dr|Dra|Prof|Profa|etc|pág|págs|cap|vol|nº|Sta|Sto|S|Jo|Mt|Lc|Mc|Rm|Cor|Sl|Pr|Is|Jr|Gn|Ex|Dt|cf|ex|aprox)\.\s*$/i;

  function dividirSentencas(texto) {
    const re = /[^.!?…]+(?:[.!?…]+["”»')\]]*|$)\s*/g;
    const partes = [];
    let m;
    while ((m = re.exec(texto)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const bruto = m[0];
      const ini = m.index;
      const fim = ini + bruto.replace(/\s+$/, "").length;
      const anterior = partes[partes.length - 1];
      if (anterior && (RE_ABREV.test(texto.slice(anterior.ini, anterior.fim)) || /^[a-zà-ÿ]/.test(bruto.trimStart()))) {
        anterior.fim = fim;
      } else {
        partes.push({ ini: ini, fim: fim });
      }
    }
    return partes.length ? partes : [{ ini: 0, fim: texto.length }];
  }

  /* ---------- índice, busca e perguntas ---------- */
  function criarIndice(paragrafos) {
    const docs = [];
    const df = new Map();
    let n = 0;
    paragrafos.forEach((p, idx) => {
      if (p.h) {
        docs.push(null);
        return;
      }
      const tf = new Map();
      tokens(p.t).forEach((w) => {
        if (w.length < 3 || STOP.has(w)) return;
        const r = radical(w);
        tf.set(r, (tf.get(r) || 0) + 1);
      });
      tf.forEach((_, r) => df.set(r, (df.get(r) || 0) + 1));
      docs.push(tf);
      n++;
    });
    return { docs: docs, df: df, n: Math.max(n, 1), dobrados: new Array(paragrafos.length) };
  }

  function idf(indice, r) {
    const d = indice.df.get(r) || 0;
    return Math.log(1 + (indice.n - d + 0.5) / (d + 0.5));
  }

  function buscar(paragrafos, indice, termo, limite) {
    const q = dobrar(termo).toLowerCase().trim();
    if (q.length < 2) return [];
    const achados = [];
    for (let i = 0; i < paragrafos.length; i++) {
      if (indice.dobrados[i] === undefined) indice.dobrados[i] = dobrar(paragrafos[i].t).toLowerCase();
      const alvo = indice.dobrados[i];
      let pos = alvo.indexOf(q);
      while (pos !== -1) {
        achados.push({ p: i, ini: pos, fim: pos + q.length });
        if (achados.length >= (limite || 1500)) return achados;
        pos = alvo.indexOf(q, pos + q.length);
      }
    }
    return achados;
  }

  function perguntar(paragrafos, indice, pergunta, k) {
    const termos = Array.from(new Set(tokens(pergunta).filter((w) => w.length >= 3 && !STOP.has(w)).map(radical)));
    if (!termos.length) return { termos: [], resultados: [] };
    const pontuados = [];
    indice.docs.forEach((tf, i) => {
      if (!tf) return;
      let nota = 0;
      let casados = 0;
      termos.forEach((r) => {
        const f = tf.get(r);
        if (f) {
          nota += idf(indice, r) * (1 + Math.log(f));
          casados++;
        }
      });
      if (!casados) return;
      nota *= 1 + 0.5 * (casados - 1);
      nota /= Math.pow(paragrafos[i].t.length, 0.25);
      pontuados.push({ p: i, nota: nota, casados: casados });
    });
    pontuados.sort((a, b) => b.nota - a.nota);
    return { termos: termos, resultados: pontuados.slice(0, k || 5) };
  }

  /* ---------- resumo extrativo ---------- */
  function resumirCapitulo(paragrafos, indice, capitulo, quantidade) {
    const frases = [];
    const peso = new Map();
    for (let i = capitulo.inicio; i <= capitulo.fim; i++) {
      const p = paragrafos[i];
      if (p.h) continue;
      tokens(p.t).forEach((w) => {
        if (w.length < 4 || STOP.has(w)) return;
        const r = radical(w);
        peso.set(r, (peso.get(r) || 0) + 1);
      });
    }
    for (let i = capitulo.inicio; i <= capitulo.fim; i++) {
      const p = paragrafos[i];
      if (p.h) continue;
      dividirSentencas(p.t).forEach((s) => {
        const texto = p.t.slice(s.ini, s.fim);
        if (texto.length < 50 || texto.length > 380) return;
        const ts = tokens(texto).filter((w) => w.length >= 4 && !STOP.has(w));
        if (ts.length < 4) return;
        let nota = 0;
        ts.forEach((w) => {
          const r = radical(w);
          nota += (peso.get(r) || 0) * idf(indice, r);
        });
        nota /= Math.sqrt(ts.length);
        frases.push({ p: i, ini: s.ini, fim: s.fim, texto: texto, nota: nota });
      });
    }
    if (!frases.length) return [];
    const n = quantidade || Math.max(3, Math.min(8, Math.round(frases.length * 0.12)));
    const escolhidas = frases
      .slice()
      .sort((a, b) => b.nota - a.nota)
      .slice(0, n);
    escolhidas.sort((a, b) => a.p - b.p || a.ini - b.ini);
    return escolhidas;
  }

  /* ---------- questões automáticas (lacunas) ---------- */
  function vocabulario(paragrafos) {
    const freq = new Map();
    paragrafos.forEach((p) => {
      if (p.h) return;
      (p.t.match(/[A-Za-zÀ-ÿ]{5,}/g) || []).forEach((w) => {
        const k = w.toLowerCase();
        freq.set(k, (freq.get(k) || 0) + 1);
      });
    });
    return freq;
  }

  function gerarQuestoes(paragrafos, de, ate, quantidade, semente) {
    const rnd = gerador(semente || 7);
    const freq = vocabulario(paragrafos);
    const total = paragrafos.length;
    const candidatas = [];

    for (let i = de; i <= ate && i < total; i++) {
      const p = paragrafos[i];
      if (p.h) continue;
      dividirSentencas(p.t).forEach((s) => {
        const frase = p.t.slice(s.ini, s.fim);
        if (frase.length < 70 || frase.length > 230 || !/[.!?…]["”»]?$/.test(frase)) return;
        let melhor = null;
        const re = /[A-Za-zÀ-ÿ]{6,}/g;
        let m;
        while ((m = re.exec(frase)) !== null) {
          const palavra = m[0];
          const f = freq.get(palavra.toLowerCase()) || 0;
          if (STOP.has(dobrar(palavra).toLowerCase()) || f < 2 || f > 40) continue;
          if (m.index < 3) continue;
          const nota = palavra.length * Math.log(1 + 40 / f);
          if (!melhor || nota > melhor.nota) melhor = { palavra: palavra, pos: m.index, nota: nota };
        }
        if (melhor) {
          candidatas.push({ p: i, c: p.c, frase: frase, resposta: melhor.palavra, pos: melhor.pos, nota: melhor.nota });
        }
      });
    }
    if (!candidatas.length) return [];

    /* espalha as questões ao longo do trecho em vez de pegar só as melhores */
    const alvo = Math.min(quantidade, candidatas.length);
    const passo = candidatas.length / alvo;
    const escolhidas = [];
    for (let k = 0; k < alvo; k++) {
      const faixa = candidatas.slice(Math.floor(k * passo), Math.max(Math.floor((k + 1) * passo), Math.floor(k * passo) + 1));
      faixa.sort((a, b) => b.nota - a.nota);
      escolhidas.push(faixa[0]);
    }

    const palavrasDoc = Array.from(freq.keys()).filter((w) => {
      const f = freq.get(w);
      return f >= 2 && f <= 60 && !STOP.has(dobrar(w));
    });

    return embaralhar(escolhidas, rnd).map((q) => {
      const resp = q.resposta;
      const maiuscula = resp[0] === resp[0].toUpperCase();
      const parecidas = palavrasDoc.filter(
        (w) =>
          Math.abs(w.length - resp.length) <= 2 &&
          w !== resp.toLowerCase() &&
          w.slice(0, 4) !== resp.toLowerCase().slice(0, 4)
      );
      const distratores = embaralhar(parecidas, rnd)
        .slice(0, 3)
        .map((w) => (maiuscula ? w[0].toUpperCase() + w.slice(1) : w));
      const opcoes = embaralhar([resp].concat(distratores), rnd);
      return {
        p: q.p,
        c: q.c,
        frase: q.frase,
        lacuna: q.frase.slice(0, q.pos) + "_____" + q.frase.slice(q.pos + resp.length),
        resposta: resp,
        opcoes: opcoes
      };
    });
  }

  raiz.LeitorTexto = {
    dobrar: dobrar,
    tokens: tokens,
    radical: radical,
    contarPalavras: contarPalavras,
    extrairParagrafos: extrairParagrafos,
    detectarCapitulos: detectarCapitulos,
    dividirSentencas: dividirSentencas,
    criarIndice: criarIndice,
    buscar: buscar,
    perguntar: perguntar,
    resumirCapitulo: resumirCapitulo,
    gerarQuestoes: gerarQuestoes,
    montarParagrafos: montarParagrafos
  };

  if (typeof module !== "undefined" && module.exports) module.exports = raiz.LeitorTexto;
})(typeof window !== "undefined" ? window : globalThis);
