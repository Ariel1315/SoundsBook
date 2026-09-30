/* ===================================================================
   SoundsBook — players de áudio customizados
   Substitui os controles nativos do navegador por botões e barra de
   progresso no visual da marca, mantendo o <audio> real por baixo.
   Só uma faixa toca por vez.
=================================================================== */

function formatarTempo(segundos) {
  if (!isFinite(segundos) || isNaN(segundos)) return "0:00";
  const min = Math.floor(segundos / 60);
  const seg = Math.floor(segundos % 60)
    .toString()
    .padStart(2, "0");
  return `${min}:${seg}`;
}

const players = document.querySelectorAll(".audio_player");

function pararOutros(exceto) {
  players.forEach((player) => {
    if (player === exceto) return;
    const audio = player.querySelector(".audio_elemento");
    audio.pause();
    player.classList.remove("tocando");
  });
}

players.forEach((player) => {
  const audio = player.querySelector(".audio_elemento");
  const botao = player.querySelector(".audio_botao");
  const barra = player.querySelector(".audio_progresso");
  const atualEl = player.querySelector(".audio_atual");
  const duracaoEl = player.querySelector(".audio_duracao");

  botao.addEventListener("click", () => {
    if (audio.paused) {
      pararOutros(player);
      const tocar = audio.play();
      if (tocar && tocar.catch) {
        tocar.catch(() => {
          /* fonte de áudio ainda não disponível nesta prévia */
        });
      }
      player.classList.add("tocando");
    } else {
      audio.pause();
      player.classList.remove("tocando");
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    duracaoEl.textContent = formatarTempo(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    atualEl.textContent = formatarTempo(audio.currentTime);
    if (audio.duration) {
      const pct = (audio.currentTime / audio.duration) * 100;
      barra.value = pct;
      barra.style.setProperty("--progresso", `${pct}%`);
    }
  });

  audio.addEventListener("ended", () => {
    player.classList.remove("tocando");
  });

  audio.addEventListener("pause", () => {
    player.classList.remove("tocando");
  });

  audio.addEventListener("play", () => {
    player.classList.add("tocando");
  });

  barra.addEventListener("input", () => {
    if (audio.duration) {
      audio.currentTime = (barra.value / 100) * audio.duration;
      barra.style.setProperty("--progresso", `${barra.value}%`);
    }
  });
});
