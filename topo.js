/* ===================================================================
   SoundsBook — botão "voltar ao topo"
   Basta incluir este arquivo na página: ele cria o botão e o estilo sozinho.
   <script src="topo.js" defer></script>
=================================================================== */
(function () {
  var estilo = document.createElement("style");
  estilo.textContent =
    ".topo_botao{position:fixed;right:24px;bottom:24px;width:48px;height:48px;border-radius:50%;" +
    "border:1.5px solid #1b1f27;background:#E2A33B;color:#1b1f27;display:flex;align-items:center;" +
    "justify-content:center;cursor:pointer;z-index:90;opacity:0;visibility:hidden;transform:translateY(12px);" +
    "box-shadow:0 12px 26px -12px rgba(27,31,39,.65);" +
    "transition:opacity .3s ease,transform .3s ease,visibility .3s ease,background .2s ease,border-color .2s ease;}" +
    ".topo_botao.visivel{opacity:1;visibility:visible;transform:translateY(0);}" +
    ".topo_botao:hover{background:#EAE2CE;border-color:#EAE2CE;}" +
    ".topo_botao:focus-visible{outline:2px solid #C97F1E;outline-offset:3px;}" +
    ".topo_botao svg{width:20px;height:20px;display:block;}" +
    "@media (max-width:560px){.topo_botao{right:16px;bottom:16px;width:44px;height:44px;}}" +
    "@media (prefers-reduced-motion:reduce){.topo_botao{transition:none;}}";
  document.head.appendChild(estilo);

  function criar() {
    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "topo_botao";
    botao.setAttribute("aria-label", "Voltar ao topo da página");
    botao.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(botao);

    function atualizar() {
      botao.classList.toggle("visivel", window.scrollY > 320);
    }

    window.addEventListener("scroll", atualizar, { passive: true });
    atualizar();

    botao.addEventListener("click", function () {
      var reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduzir ? "auto" : "smooth" });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", criar);
  } else {
    criar();
  }
})();
