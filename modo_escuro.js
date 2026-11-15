/* ===================================================================
   SoundsBook — modo escuro (apenas páginas de leitura)
   Deve ser carregado no <head>, SEM "defer", para aplicar a escolha salva
   antes de a página aparecer (evita o "piscar" de claro para escuro).
   <script src="modo_escuro.js"></script>
=================================================================== */
(function () {
  var CHAVE = "soundsbook_modo";
  var raiz = document.documentElement;

  function lerPreferencia() {
    try {
      return localStorage.getItem(CHAVE);
    } catch (e) {
      return null;
    }
  }

  function salvarPreferencia(valor) {
    try {
      localStorage.setItem(CHAVE, valor);
    } catch (e) {
      /* navegação privada: a escolha vale só enquanto a página estiver aberta */
    }
  }

  if (lerPreferencia() === "escuro") {
    raiz.classList.add("escuro");
  }

  function criarBotao() {
    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "modo_botao";
    botao.innerHTML =
      '<svg class="icone_lua" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
      '<svg class="icone_sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

    function atualizarRotulo() {
      var escuro = raiz.classList.contains("escuro");
      botao.setAttribute("aria-pressed", escuro ? "true" : "false");
      botao.setAttribute("aria-label", escuro ? "Desativar modo escuro" : "Ativar modo escuro");
      botao.title = escuro ? "Modo claro" : "Modo escuro";
    }

    botao.addEventListener("click", function () {
      var escuro = raiz.classList.toggle("escuro");
      salvarPreferencia(escuro ? "escuro" : "claro");
      atualizarRotulo();
    });

    atualizarRotulo();
    document.body.appendChild(botao);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", criarBotao);
  } else {
    criarBotao();
  }
})();
