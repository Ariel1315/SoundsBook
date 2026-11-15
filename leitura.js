/* ===================================================================
   SoundsBook — trilhas sonoras da leitura
   Cada cartão controla um <audio> em loop. Só uma faixa toca por vez.
=================================================================== */

const players = document.querySelectorAll(".audio_player");

function pararOutros(exceto) {
  players.forEach((player) => {
    if (player === exceto) return;
    player.querySelector(".audio_elemento").pause();
  });
}

players.forEach((player) => {
  const audio = player.querySelector(".audio_elemento");
  const botao = player.querySelector(".audio_botao");
  const nome = player.querySelector(".audio_faixa_nome").textContent;

  function alternar() {
    if (audio.paused) {
      pararOutros(player);
      const tocar = audio.play();
      if (tocar && tocar.catch) {
        tocar.catch(() => {
          player.classList.remove("tocando");
        });
      }
    } else {
      audio.pause();
    }
  }

  /* o cartão inteiro é clicável; o botão continua sendo o controle acessível */
  player.addEventListener("click", (evento) => {
    if (evento.target.closest(".audio_botao")) return;
    alternar();
  });

  botao.addEventListener("click", alternar);

  audio.addEventListener("play", () => {
    player.classList.add("tocando");
    botao.setAttribute("aria-label", `Pausar ${nome}`);
  });

  audio.addEventListener("pause", () => {
    player.classList.remove("tocando");
    botao.setAttribute("aria-label", `Tocar ${nome}`);
  });
});
