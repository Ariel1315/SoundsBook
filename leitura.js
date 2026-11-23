/* ===================================================================
   SoundsBook — trilhas sonoras da leitura
   Lê o catálogo em faixas_dados.js, monta a lista suspensa de gêneros e
   temas e desenha os cartões da seleção. Cada faixa toca em loop e só uma
   toca por vez. Faixas sem arquivo aparecem como "Em breve".
=================================================================== */

(function () {
  const secao = document.querySelector(".audios");
  if (!secao) return;

  if (typeof GRUPOS === "undefined" || typeof FAIXAS === "undefined") {
    console.warn("SoundsBook: inclua faixas_dados.js antes de leitura.js.");
    return;
  }

  const grade = secao.querySelector("#audiosGrade");
  const seletor = secao.querySelector("#seletorGenero");
  const sugerido = secao.dataset.sugerido || "";

  const BLOCOS = [
    { tipo: "destaque", rotulo: "Disponíveis agora" },
    { tipo: "genero", rotulo: "Gêneros literários" },
    { tipo: "tema", rotulo: "Temas e atmosferas" }
  ];

  function criar(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto) el.textContent = texto;
    return el;
  }

  function temFaixaDisponivel(grupoId) {
    return FAIXAS.some((f) => f.grupo === grupoId && f.src);
  }

  /* ---------- lista suspensa ---------- */
  BLOCOS.forEach((bloco) => {
    const grupos = GRUPOS.filter((g) => g.tipo === bloco.tipo);
    if (!grupos.length) return;

    const optgroup = document.createElement("optgroup");
    optgroup.label = bloco.rotulo;

    grupos.forEach((g) => {
      let texto = g.rotulo;
      if (g.id === sugerido) texto += " ★ sugerido para este livro";
      if (g.tipo !== "destaque" && !temFaixaDisponivel(g.id)) texto += " (em breve)";
      const opcao = criar("option", "", texto);
      opcao.value = g.id;
      optgroup.appendChild(opcao);
    });

    seletor.appendChild(optgroup);
  });

  /* ---------- controle de reprodução ---------- */
  function todosOsAudios() {
    return grade.querySelectorAll(".audio_elemento");
  }

  function pararOutros(atual) {
    todosOsAudios().forEach((a) => {
      if (a !== atual) a.pause();
    });
  }

  function pararTudo() {
    pararOutros(null);
  }

  /* ---------- cartão de faixa ---------- */
  function criarCartao(faixa) {
    const disponivel = Boolean(faixa.src);
    const cartao = criar("div", "audio_player" + (disponivel ? "" : " indisponivel"));

    const botao = criar("button", "audio_botao");
    botao.type = "button";
    botao.disabled = !disponivel;
    botao.setAttribute(
      "aria-label",
      (disponivel ? "Tocar " : "Ainda indisponível: ") + faixa.titulo
    );
    botao.innerHTML =
      '<span class="audio_icone audio_icone_play">&#9658;</span>' +
      '<span class="audio_icone audio_icone_pause">&#10074;&#10074;</span>';

    const texto = criar("div", "audio_texto");
    const nome = criar("span", "audio_faixa_nome", faixa.titulo);
    const autor = criar("span", "audio_autor");

    if (!disponivel) {
      autor.textContent = "Faixa a caminho";
    } else if (faixa.autor) {
      autor.append("Criado por - ");
      autor.appendChild(criar("strong", "", faixa.autor));
    } else {
      autor.textContent = "Autor desconhecido";
    }

    texto.append(nome, autor);
    cartao.append(botao, texto);

    if (!disponivel) {
      cartao.appendChild(criar("span", "audio_breve", "Em breve"));
      return cartao;
    }

    const ondas = criar("span", "audio_ondas");
    ondas.setAttribute("aria-hidden", "true");
    ondas.innerHTML = "<span></span><span></span><span></span><span></span>";
    cartao.appendChild(ondas);

    const audio = criar("audio", "audio_elemento");
    audio.loop = true;
    audio.preload = "none";
    audio.src = faixa.src;
    cartao.appendChild(audio);

    function alternar() {
      if (audio.paused) {
        pararOutros(audio);
        const tocar = audio.play();
        if (tocar && tocar.catch) {
          tocar.catch(() => cartao.classList.remove("tocando"));
        }
      } else {
        audio.pause();
      }
    }

    /* o cartão inteiro é clicável; o botão continua sendo o controle acessível */
    cartao.addEventListener("click", (evento) => {
      if (evento.target.closest(".audio_botao")) return;
      alternar();
    });
    botao.addEventListener("click", alternar);

    audio.addEventListener("play", () => {
      cartao.classList.add("tocando");
      botao.setAttribute("aria-label", "Pausar " + faixa.titulo);
    });

    audio.addEventListener("pause", () => {
      cartao.classList.remove("tocando");
      botao.setAttribute("aria-label", "Tocar " + faixa.titulo);
    });

    audio.addEventListener("error", () => {
      cartao.classList.remove("tocando");
      cartao.classList.add("erro");
      autor.textContent = "Arquivo não encontrado";
    });

    return cartao;
  }

  /* ---------- desenhar a seleção ---------- */
  function mostrarGrupo(grupoId) {
    pararTudo();
    grade.textContent = "";
    FAIXAS.filter((f) => f.grupo === grupoId).forEach((f) => {
      grade.appendChild(criarCartao(f));
    });
  }

  seletor.addEventListener("change", () => mostrarGrupo(seletor.value));

  seletor.value = "destaque";
  mostrarGrupo("destaque");
})();
