/* ===================================================================
   SoundsBook — catálogo de faixas (um único lugar para editar)

   Usado por: confissoes.html, imitacao.html, cartomante.html e faixas.html.

   COMO ADICIONAR UMA FAIXA NOVA
   1. Coloque o arquivo de áudio na mesma pasta do site.
   2. Na faixa desejada abaixo, preencha  src  com o nome do arquivo
      (ex.: src: "romance1.mp3") e  autor  com o nome do artista.
   3. Pronto: o cartão "Em breve" passa a tocar sozinho.

   Para criar um gênero/tema novo: adicione um item em GRUPOS e as faixas
   correspondentes em FAIXAS (usando o mesmo "id" no campo  grupo ).
=================================================================== */

/* tipo: "destaque" | "genero" | "tema"  (define em qual bloco da lista aparece) */
const GRUPOS = [
  { id: "destaque", rotulo: "Em destaque", tipo: "destaque" },

  { id: "romance", rotulo: "Romance", tipo: "genero" },
  { id: "suspense", rotulo: "Suspense e mistério", tipo: "genero" },
  { id: "drama", rotulo: "Drama", tipo: "genero" },
  { id: "fantasia", rotulo: "Fantasia", tipo: "genero" },
  { id: "ficcao", rotulo: "Ficção científica", tipo: "genero" },
  { id: "terror", rotulo: "Terror", tipo: "genero" },
  { id: "poesia", rotulo: "Poesia", tipo: "genero" },
  { id: "aventura", rotulo: "Aventura", tipo: "genero" },
  { id: "espiritualidade", rotulo: "Filosofia e espiritualidade", tipo: "genero" },

  { id: "chuva", rotulo: "Chuva e aconchego", tipo: "tema" },
  { id: "noite", rotulo: "Noite e calmaria", tipo: "tema" },
  { id: "foco", rotulo: "Foco e concentração", tipo: "tema" },
  { id: "natureza", rotulo: "Natureza e paisagens", tipo: "tema" }
];

/* src vazio ("") = faixa ainda indisponível (aparece como "Em breve")
   autor: null = "Autor desconhecido" */
const FAIXAS = [
  /* ---------- em destaque (já disponíveis) ---------- */
  { grupo: "destaque", titulo: "Faixa 01", autor: null, src: "desc.mp4" },
  { grupo: "destaque", titulo: "Faixa 02", autor: null, src: "Faixa2.mp4" },
  { grupo: "destaque", titulo: "Faixa 03", autor: null, src: "vrum.mp4" },
  { grupo: "destaque", titulo: "Faixa 04", autor: "Jaqueline01", src: "jaque.mp4" },
  { grupo: "destaque", titulo: "Faixa 05", autor: "Jesse Gallagher", src: "Spirit of Fire - Jesse Gallagher.mp3" },
  { grupo: "destaque", titulo: "Faixa 06", autor: "The Soundlings", src: "The Swan - The Soundlings.mp3" },

  /* ---------- gêneros literários ---------- */
  { grupo: "romance", titulo: "Romance 01", autor: null, src: "" },
  { grupo: "romance", titulo: "Romance 02", autor: null, src: "" },

  { grupo: "suspense", titulo: "Suspense 01", autor: null, src: "" },
  { grupo: "suspense", titulo: "Suspense 02", autor: null, src: "" },

  { grupo: "drama", titulo: "Drama 01", autor: null, src: "" },
  { grupo: "drama", titulo: "Drama 02", autor: null, src: "" },

  { grupo: "fantasia", titulo: "Fantasia 01", autor: null, src: "" },
  { grupo: "fantasia", titulo: "Fantasia 02", autor: null, src: "" },

  { grupo: "ficcao", titulo: "Ficção científica 01", autor: null, src: "" },
  { grupo: "ficcao", titulo: "Ficção científica 02", autor: null, src: "" },

  { grupo: "terror", titulo: "Terror 01", autor: null, src: "" },
  { grupo: "terror", titulo: "Terror 02", autor: null, src: "" },

  { grupo: "poesia", titulo: "Poesia 01", autor: null, src: "" },
  { grupo: "poesia", titulo: "Poesia 02", autor: null, src: "" },

  { grupo: "aventura", titulo: "Aventura 01", autor: null, src: "" },
  { grupo: "aventura", titulo: "Aventura 02", autor: null, src: "" },

  { grupo: "espiritualidade", titulo: "Espiritualidade 01", autor: null, src: "" },
  { grupo: "espiritualidade", titulo: "Espiritualidade 02", autor: null, src: "" },

  /* ---------- temas e atmosferas ---------- */
  { grupo: "chuva", titulo: "Chuva 01", autor: null, src: "" },
  { grupo: "chuva", titulo: "Chuva 02", autor: null, src: "" },

  { grupo: "noite", titulo: "Noite 01", autor: null, src: "" },
  { grupo: "noite", titulo: "Noite 02", autor: null, src: "" },

  { grupo: "foco", titulo: "Foco 01", autor: null, src: "" },
  { grupo: "foco", titulo: "Foco 02", autor: null, src: "" },

  { grupo: "natureza", titulo: "Natureza 01", autor: null, src: "" },
  { grupo: "natureza", titulo: "Natureza 02", autor: null, src: "" }
];
