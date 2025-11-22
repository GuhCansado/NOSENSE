/* ===========================================
   CONFIG & API DISCOVERY
=========================================== */

let API = null;

async function carregarConfigAPI() {
  try {
    const r = await fetch(
      "https://raw.githubusercontent.com/GuhCansado/NOSENSE/main/server_status.json"
    );
    const js = await r.json();
    API = js.url_api_base;

    console.log("API carregada:", API);

    atualizarStatus();
    carregarPosts();
  } catch (e) {
    console.error("Erro ao carregar API:", e);
    const txt = document.getElementById("status-text");
    if (txt) txt.textContent = "Erro ao carregar API";
  }
}

carregarConfigAPI();

/* ===========================================
   UTILIDADES
=========================================== */

function escapeHtml(text) {
  if (!text) return "";
  return text.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
}

function highlightTags(text) {
  return escapeHtml(text).replace(
    /#([\p{L}\p{N}_-]+)/gu,
    '<span class="tag">#$1</span>'
  );
}

function setButtonLoading(btn, isLoading, label = "Carregando...") {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent;
    }
    btn.textContent = label;
    btn.classList.add("is-loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("is-loading");
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
    }
  }
}

// fingerprint simples por dispositivo (pra votos/denúncia)
function getFingerprint() {
  let fp = localStorage.getItem("vp_fingerprint");
  if (!fp) {
    fp = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem("vp_fingerprint", fp);
  }
  return fp;
}

/* ===========================================
   TEMA
=========================================== */

const themeToggle = document.getElementById("theme-toggle");

function aplicarTemaInicial() {
  const salvo = localStorage.getItem("vp_theme") || "dark";
  document.body.dataset.theme = salvo;
  if (themeToggle) {
    themeToggle.textContent = salvo === "dark" ? "☾" : "☀";
  }
}

if (themeToggle) {
  aplicarTemaInicial();
  themeToggle.addEventListener("click", () => {
    const atual = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = atual;
    localStorage.setItem("vp_theme", atual);
    themeToggle.textContent = atual === "dark" ? "☾" : "☀";
  });
}

/* ===========================================
   STATUS DO SERVIDOR
=========================================== */

async function atualizarStatus() {
  if (!API) return;
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");

  try {
    const r = await fetch(`${API}/api/status`);
    if (!r.ok) throw new Error();
    if (txt) txt.textContent = "Servidor Online";
    if (dot) dot.className = "status-dot online";
  } catch {
    if (txt) txt.textContent = "Servidor Offline";
    if (dot) dot.className = "status-dot offline";
  }
}

setInterval(() => API && atualizarStatus(), 5000);

/* ===========================================
   PIRÂMIDE 3D (Three.js)
=========================================== */

let classeEscolhida = null;
let acaoPendente = null; 
// { tipo: 'post', texto } ou { tipo: 'reply', texto, postId, textarea, postEl }

const classModal = document.getElementById("class-modal-backdrop");
const modalClose = document.getElementById("modal-close");
const pyramidCanvas = document.getElementById("pyramid-canvas");

function abrirModalClasse() {
  if (classModal) classModal.classList.add("show");
}

function fecharModalClasse() {
  if (classModal) classModal.classList.remove("show");
}

if (modalClose) {
  modalClose.addEventListener("click", fecharModalClasse);
}

if (classModal) {
  classModal.addEventListener("click", (e) => {
    if (e.target === classModal) fecharModalClasse();
  });
}

function initPyramid3D() {
  if (!pyramidCanvas || !window.THREE) return;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);

  const w = pyramidCanvas.clientWidth;
  const h = pyramidCanvas.clientHeight || 260;

  const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
  camera.position.set(0, 2.3, 5);

  const renderer = new THREE.WebGLRenderer({ canvas: pyramidCanvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(w, h);

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 5, 4);
  scene.add(dir);

  const group = new THREE.Group();
  scene.add(group);

  const materials = {
    base: new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      metalness: 0.3,
      roughness: 0.35
    }),
    meio: new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      metalness: 0.35,
      roughness: 0.35
    }),
    topo: new THREE.MeshStandardMaterial({
      color: 0xef4444,
      metalness: 0.4,
      roughness: 0.35
    })
  };

  function createSegment(widthTop, widthBottom, height, colorKey, y) {
    const geo = new THREE.CylinderGeometry(widthTop, widthBottom, height, 4, 1, false);
    const mesh = new THREE.Mesh(geo, materials[colorKey]);
    mesh.rotation.y = Math.PI / 4;
    mesh.position.y = y;
    mesh.userData.classe = colorKey;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  const base = createSegment(1.7, 2.4, 0.7, "base", -0.9);
  const middle = createSegment(1.2, 1.7, 0.7, "meio", -0.2);
  const top = createSegment(0.7, 1.2, 0.7, "topo", 0.5);

  group.rotation.x = THREE.MathUtils.degToRad(18);
  group.rotation.y = THREE.MathUtils.degToRad(-25);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedMesh = null;

  function setSelected(mesh) {
    if (selectedMesh) {
      selectedMesh.scale.set(1, 1, 1);
      selectedMesh.material.emissive && (selectedMesh.material.emissive.setHex(0x000000));
    }
    selectedMesh = mesh;
    if (selectedMesh) {
      selectedMesh.scale.set(1.06, 1.08, 1.06);
      if (!selectedMesh.material.emissive) {
        selectedMesh.material.emissive = new THREE.Color(0xffffff);
      }
      selectedMesh.material.emissive.setHex(0xffffff);
    }
  }

  function onClick(e) {
    const rect = pyramidCanvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(group.children);

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const classe = mesh.userData.classe;
      if (classe) {
        classeEscolhida = classe;
        setSelected(mesh);
        fecharModalClasse();

        // Executa ação pendente, se existir
        if (acaoPendente) {
          if (acaoPendente.tipo === "post") {
            enviarPost(acaoPendente.texto);
          } else if (acaoPendente.tipo === "reply") {
            enviarResposta(
              acaoPendente.postId,
              acaoPendente.texto,
              acaoPendente.textarea,
              acaoPendente.postEl
            );
          }
          acaoPendente = null;
        }
      }
    }
  }

  pyramidCanvas.addEventListener("click", onClick);

  window.addEventListener("resize", () => {
    const nw = pyramidCanvas.clientWidth;
    const nh = pyramidCanvas.clientHeight || 260;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });

  function animate() {
    requestAnimationFrame(animate);
    group.rotation.y += 0.003;
    renderer.render(scene, camera);
  }
  animate();
}

document.addEventListener("DOMContentLoaded", initPyramid3D);

/* ===========================================
   POSTAR
=========================================== */

const postText = document.getElementById("post-text");
const postError = document.getElementById("post-error");
const btnPostar = document.getElementById("btn-postar");

async function enviarPost(texto) {
  if (!API) return alert("API não carregada.");

  setButtonLoading(btnPostar, true, "Postando...");

  try {
    const r = await fetch(`${API}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, classe: classeEscolhida })
    });
    const js = await r.json();

    if (js.error) {
      if (postError) postError.textContent = js.error;
      return;
    }

    if (postText) postText.value = "";
    carregarPosts();
  } catch (e) {
    console.error(e);
    if (postError) postError.textContent = "Erro ao postar";
  } finally {
    setButtonLoading(btnPostar, false);
  }
}

if (btnPostar) {
  btnPostar.addEventListener("click", (e) => {
    e.preventDefault();
    const texto = postText ? postText.value.trim() : "";
    if (!texto) {
      if (postError) postError.textContent = "Digite algo.";
      return;
    }

    if (!classeEscolhida) {
      if (postError) postError.textContent = "Escolha sua posição na pirâmide.";
      acaoPendente = { tipo: "post", texto };
      abrirModalClasse();
      return;
    }

    enviarPost(texto);
  });
}

/* ===========================================
   FEED
=========================================== */

const feedEl = document.getElementById("feed");

async function carregarPosts() {
  if (!API || !feedEl) return;

  feedEl.innerHTML = "Carregando...";

  try {
    const r = await fetch(`${API}/api/posts`);
    const posts = await r.json();

    if (!Array.isArray(posts)) {
      console.error("Formato inesperado de posts:", posts);
      throw new Error("Formato inesperado");
    }

    renderFeed(posts);
  } catch (err) {
    console.error("Erro ao carregar posts:", err);
    feedEl.innerHTML = "Erro ao carregar posts.";
  }
}

function renderFeed(posts) {
  feedEl.innerHTML = "";

  posts.forEach((p) => {
    const el = document.createElement("div");
    el.className = "post";

    const upvotes = p.upvotes || 0;

    el.innerHTML = `
      <div class="post-header">
        <div class="avatar" style="background:${p.cor_classe || "#4b5563"}">
          ${p.avatar?.emoji || "😶"}
        </div>
        <div class="post-header-info">
          <div class="alias">${escapeHtml(p.alias || "Anônimo")}</div>
          <div class="meta-line">${new Date(p.created_at).toLocaleString("pt-BR")}</div>
        </div>
      </div>

      <div class="post-text">
        ${highlightTags(p.texto || "")}
      </div>

      <div class="post-actions">
        <button class="like-btn">
          <span>▲</span> <span class="like-label">${upvotes}</span>
        </button>

        <button class="report-btn">
          🚩 Denunciar
        </button>

        <button class="ver-respostas">
          Ver respostas (${p.replies_count || 0})
        </button>
      </div>

      <div class="reply-box">
        <textarea class="reply-textarea" placeholder="Responder..."></textarea>
        <button class="primary-btn responder-btn">Enviar</button>
        <div class="replies"></div>
      </div>
    `;

    // like
    const likeBtn = el.querySelector(".like-btn");
    const likeLabel = el.querySelector(".like-label");

    likeBtn.addEventListener("click", async () => {
      if (!API) return;
      likeBtn.disabled = true;
      try {
        const r = await fetch(`${API}/api/posts/${p.id}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delta: 1, fingerprint: getFingerprint() })
        });
        const js = await r.json();
        if (!js.error) {
          likeLabel.textContent = js.upvotes || 0;
          likeBtn.classList.add("active");
        } else {
          alert(js.error);
        }
      } catch (e) {
        console.error(e);
        alert("Erro ao votar.");
      } finally {
        likeBtn.disabled = false;
      }
    });

    // denúncia
    const reportBtn = el.querySelector(".report-btn");
    reportBtn.addEventListener("click", async () => {
      if (!API) return;
      reportBtn.disabled = true;
      try {
        const r = await fetch(`${API}/api/posts/${p.id}/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fingerprint: getFingerprint() })
        });
        const js = await r.json();
        if (!js.error) {
          alert("Denúncia registrada. Obrigado pelo aviso.");
        } else {
          alert(js.error);
        }
      } catch (e) {
        console.error(e);
        alert("Erro ao denunciar.");
      } finally {
        reportBtn.disabled = false;
      }
    });

    // respostas
    const btnToggle = el.querySelector(".ver-respostas");
    const box = el.querySelector(".reply-box");
    const replyBtn = el.querySelector(".responder-btn");
    const replyTextarea = el.querySelector(".reply-textarea");

    btnToggle.addEventListener("click", () => {
      const open = box.style.display === "block";
      box.style.display = open ? "none" : "block";
      if (!open) carregarRespostas(p.id, el);
    });

    replyBtn.addEventListener("click", () => {
      const texto = replyTextarea.value.trim();
      if (!texto) return;

      if (!classeEscolhida) {
        if (postError) postError.textContent = "Escolha sua posição na pirâmide para responder.";
        acaoPendente = {
          tipo: "reply",
          texto,
          postId: p.id,
          textarea: replyTextarea,
          postEl: el
        };
        abrirModalClasse();
        return;
      }

      enviarResposta(p.id, texto, replyTextarea, el);
    });

    feedEl.appendChild(el);
  });
}

/* ===========================================
   RESPOSTAS
=========================================== */

async function enviarResposta(idPost, texto, textareaEl, postEl) {
  if (!API) return;

  const btn = postEl.querySelector(".responder-btn");
  setButtonLoading(btn, true, "Enviando...");

  try {
    const r = await fetch(`${API}/api/posts/${idPost}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto, classe: classeEscolhida })
    });
    const js = await r.json();

    if (js.error) {
      alert(js.error);
      return;
    }

    textareaEl.value = "";
    carregarRespostas(idPost, postEl);
  } catch (e) {
    console.error(e);
    alert("Erro ao enviar resposta.");
  } finally {
    setButtonLoading(btn, false);
  }
}

async function carregarRespostas(id, postEl) {
  if (!API) return;

  try {
    const r = await fetch(`${API}/api/posts/${id}/replies`);
    let data = await r.json();

    let replies = Array.isArray(data) ? data :
      (Array.isArray(data.replies) ? data.replies : []);

    const box = postEl.querySelector(".replies");
    box.innerHTML = "";

    replies.forEach((rp) => {
      const alias = rp.alias || rp.user || rp.nome || "Anônimo";
      const texto = rp.texto || rp.message || rp.msg || rp.reply_text || "";

      const d = document.createElement("div");
      d.className = "reply";
      d.innerHTML = `
        <div class="reply-alias">${escapeHtml(alias)}</div>
        <div class="reply-text">${highlightTags(texto)}</div>
      `;
      box.appendChild(d);
    });

    const btn = postEl.querySelector(".ver-respostas");
    btn.textContent = `Ver respostas (${replies.length})`;
  } catch (e) {
    console.error("Erro ao carregar respostas:", e);
    postEl.querySelector(".replies").innerHTML = "Erro ao carregar respostas.";
  }
}

/* ===========================================
   AJUDA (BOTÃO ?)
=========================================== */

document.querySelector(".floating-help")?.addEventListener("click", () => {
  alert(
    "Este espaço é anônimo. As postagens são associadas apenas à posição na pirâmide (base, meio ou topo), nunca à sua identidade."
  );
});
