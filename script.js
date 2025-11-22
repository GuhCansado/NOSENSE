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

function setButtonLoading(btn, isLoading, label) {
  if (!btn) return;
  if (isLoading) {
    if (!btn.dataset.originalText) {
      btn.dataset.originalText = btn.textContent;
    }
    btn.textContent = label || "Carregando...";
    btn.disabled = true;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalText) {
      btn.textContent = btn.dataset.originalText;
    }
  }
}

function getFingerprint() {
  let fp = localStorage.getItem("vp_fingerprint");
  if (!fp) {
    fp = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
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
    if (dot) {
      dot.classList.add("online");
      dot.classList.remove("offline");
    }
  } catch {
    if (txt) txt.textContent = "Servidor Offline";
    if (dot) {
      dot.classList.add("offline");
      dot.classList.remove("online");
    }
  }
}

setInterval(() => API && atualizarStatus(), 5000);

/* ===========================================
   PIRÂMIDE 3D (Three.js)
=========================================== */

let classeEscolhida = null;
let acaoPendente = null;

const classModal = document.getElementById("class-modal-backdrop");
const modalClose = document.getElementById("modal-close");
const pyramidCanvas = document.getElementById("pyramid-canvas");

let pyramidInitialized = false;
let pyramidScene, pyramidCamera, pyramidRenderer, pyramidGroup;
let pyramidRaycaster, pyramidMouse;
let hoveredMesh = null;
let selectedMesh = null;
let targetRotY = -0.35;
let currentRotY = -0.35;

function openClassModal() {
  if (!classModal) return;
  classModal.classList.add("show");
  setTimeout(() => {
    if (!pyramidInitialized) {
      initPyramid3D();
      pyramidInitialized = true;
    } else {
      resizePyramid();
    }
  }, 120);
}

function closeClassModal() {
  if (!classModal) return;
  classModal.classList.remove("show");
}

if (modalClose) {
  modalClose.addEventListener("click", closeClassModal);
}

if (classModal) {
  classModal.addEventListener("click", (e) => {
    if (e.target === classModal) closeClassModal();
  });
}

function resizePyramid() {
  if (!pyramidRenderer || !pyramidCamera || !pyramidCanvas) return;
  const rect = pyramidCanvas.getBoundingClientRect();
  const w = rect.width || 400;
  const h = rect.height || 260;
  pyramidCamera.aspect = w / h;
  pyramidCamera.updateProjectionMatrix();
  pyramidRenderer.setSize(w, h, false);
}

function setSelectedMesh(mesh) {
  if (selectedMesh) {
    selectedMesh.scale.set(1, 1, 1);
    if (selectedMesh.material && selectedMesh.material.emissive) {
      selectedMesh.material.emissiveIntensity = 0.3;
    }
  }
  selectedMesh = mesh;
  if (selectedMesh && selectedMesh.material && selectedMesh.material.emissive) {
    selectedMesh.scale.set(1.06, 1.08, 1.06);
    selectedMesh.material.emissiveIntensity = 1.2;
  }
}

function setHoveredMesh(mesh) {
  if (hoveredMesh && hoveredMesh !== selectedMesh) {
    hoveredMesh.scale.set(1, 1, 1);
    if (hoveredMesh.material && hoveredMesh.material.emissive) {
      hoveredMesh.material.emissiveIntensity = 0.3;
    }
  }
  hoveredMesh = mesh;
  if (hoveredMesh && hoveredMesh !== selectedMesh) {
    hoveredMesh.scale.set(1.03, 1.04, 1.03);
    if (hoveredMesh.material && hoveredMesh.material.emissive) {
      hoveredMesh.material.emissiveIntensity = 0.7;
    }
  }
}

function initPyramid3D() {
  if (!pyramidCanvas || !window.THREE) return;

  // === Cena ===
  pyramidScene = new THREE.Scene();
  pyramidScene.background = new THREE.Color(0x020617);

  const rect = pyramidCanvas.getBoundingClientRect();
  const w = rect.width || 500;
  const h = rect.height || 320;

  // === Câmera (centralizada mostrando a base) ===
  pyramidCamera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
  pyramidCamera.position.set(0, 2.4, 7.0);
  pyramidCamera.lookAt(0, 1.4, 0);

  // === Renderer ===
  pyramidRenderer = new THREE.WebGLRenderer({
    canvas: pyramidCanvas,
    antialias: true,
    alpha: true
  });
  pyramidRenderer.setPixelRatio(window.devicePixelRatio || 1);
  pyramidRenderer.setSize(w, h, false);

  // === Luzes ===
  pyramidScene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(4, 6, 5);
  pyramidScene.add(dir);

  const glowLight = new THREE.PointLight(0x7f8cff, 1.7, 16);
  glowLight.position.set(-3, 4, 4);
  pyramidScene.add(glowLight);

  // === Grupo principal (move tudo junto) ===
  pyramidGroup = new THREE.Group();
  pyramidGroup.position.set(0, 1.4, 0);
  pyramidScene.add(pyramidGroup);

  // ============================
  //   MATERIAIS "PLASMA"
  // ============================
  function plasmaMaterial(colorHex) {
    return new THREE.MeshPhongMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.4,
      shininess: 100,
      transparent: true,
      opacity: 0.75
    });
  }

  const baseMat = plasmaMaterial(0x22c55e);
  const midMat  = plasmaMaterial(0x3b82f6);
  const topMat  = plasmaMaterial(0xef4444);

  // Wireframe sutil por cima (efeito holograma)
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    wireframe: true,
    depthWrite: false
  });

  // Guardar segmentos para animar depois
  const plasmaSegments = [];

  // ============================
  //   TEXTO 3D (Sprite) POR CAMADA
  // ============================
  function criarTextoSprite(texto, classe, corHex) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 256;
    canvas.height = 128;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cor = "#" + corHex.toString(16).padStart(6, "0");

    ctx.font = "bold 40px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = cor;
    ctx.shadowColor = cor;
    ctx.shadowBlur = 22;
    ctx.fillText(texto, canvas.width / 2, canvas.height / 2);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;

    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.9
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.2, 1.0, 1);
    sprite.userData.classe = classe; // clicável!
    return sprite;
  }

  // ============================
  //   CRIA SEGMENTO DA PIRÂMIDE
  // ============================
  function createSegment(top, bottom, height, mat, classe, y, labelText, labelColor) {
    const geo = new THREE.CylinderGeometry(top, bottom, height, 4, 1, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 4;
    mesh.position.y = y;
    mesh.userData.classe = classe;

    const outline = new THREE.Mesh(geo, outlineMaterial);
    outline.rotation.copy(mesh.rotation);
    outline.position.copy(mesh.position);
    outline.userData.classe = classe;

    const label = criarTextoSprite(labelText, classe, labelColor);
    label.position.set(0, y + 0.05, 0);

    pyramidGroup.add(mesh);
    pyramidGroup.add(outline);
    pyramidGroup.add(label);

    plasmaSegments.push(mesh);

    return mesh;
  }

  // ============================
  //   ESTRUTURA DA PIRÂMIDE
  // ============================
  const h = 1.1;

  createSegment(1.9, 3.1, h * 1.05, baseMat, "base", -h * 1.1, "BASE", 0x86efac);
  createSegment(1.15, 1.9, h * 0.98, midMat,  "meio",  0,        "MEIO", 0x93c5fd);
  createSegment(0.55, 1.15, h * 0.9,  topMat, "topo",  h * 1.1,  "TOPO", 0xfca5a5);

  // Inclinação inicial
  pyramidGroup.rotation.x = THREE.MathUtils.degToRad(20);
  pyramidGroup.rotation.y = targetRotY;

  // ============================
  //   PARTÍCULAS "ENERGIA"
  // ============================
  const particleCount = 420;
  const positions = new Float32Array(particleCount * 3);
  const speeds    = new Float32Array(particleCount);

  const radius = 1.6;      // raio da base das partículas
  const minY   = -1.4;     // ponto mais baixo (abaixo da base)
  const maxY   =  2.6;     // topo do volume

  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r     = Math.random() * radius * 0.8;

    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = minY + Math.random() * (maxY - minY);

    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    speeds[i] = 0.008 + Math.random() * 0.012;
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x9bdcff,
    size: 0.05,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  pyramidGroup.add(particles);

  // ============================
  //   RAYCASTER / INTERAÇÃO
  // ============================
  pyramidRaycaster = new THREE.Raycaster();
  pyramidMouse = new THREE.Vector2();

  function pointerMove(e) {
    const r = pyramidCanvas.getBoundingClientRect();
    pyramidMouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pyramidMouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;

    const tilt = (e.clientX - r.left) / r.width - 0.5;
    targetRotY = tilt * 0.6;

    pyramidRaycaster.setFromCamera(pyramidMouse, pyramidCamera);
    const hits = pyramidRaycaster.intersectObjects(pyramidGroup.children, true);

    if (hits.length > 0) {
      // acha o primeiro com userData.classe
      const obj = hits.find(o => o.object.userData && o.object.userData.classe);
      if (obj) {
        setHoveredMesh(obj.object);
        return;
      }
    }
    setHoveredMesh(null);
  }

  function handleClick() {
    pyramidRaycaster.setFromCamera(pyramidMouse, pyramidCamera);
    const hits = pyramidRaycaster.intersectObjects(pyramidGroup.children, true);
    if (!hits.length) return;

    const objHit = hits.find(o => o.object.userData && o.object.userData.classe);
    if (objHit) {
      const classe = objHit.object.userData.classe;
      selecionarClasse(classe, null);
    }
  }

  pyramidCanvas.addEventListener("mousemove", pointerMove);
  pyramidCanvas.addEventListener("click", handleClick);
  window.addEventListener("resize", resizePyramid);

  const clock = new THREE.Clock();

  // ============================
  //          LOOP
  // ============================
  function animate() {
    requestAnimationFrame(animate);

    const t = clock.getElapsedTime();

    // Rotação suave
    currentRotY += (targetRotY - currentRotY) * 0.07;
    pyramidGroup.rotation.y = currentRotY;

    // Efeito "plasma" pulsando em cada camada
    plasmaSegments.forEach((mesh, idx) => {
      const pulse = 0.4 + 0.25 * Math.sin(t * 2.2 + idx);
      const op    = 0.6 + 0.15 * Math.sin(t * 1.8 + idx * 0.7);

      mesh.material.emissiveIntensity = pulse;
      mesh.material.opacity = op;
    });

    // Partículas subindo
    const posAttr = particleGeometry.getAttribute("position");
    for (let i = 0; i < particleCount; i++) {
      let y = posAttr.getY(i);
      let x = posAttr.getX(i);
      let z = posAttr.getZ(i);

      y += speeds[i];                 // sobe
      const swirl = Math.sin(t * 0.8 + x * 3 + z * 3) * 0.003;
      x += swirl;
      z -= swirl;

      if (y > maxY) {
        y = minY;
      }

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;

    // Textos sempre voltados para a câmera
    pyramidGroup.children.forEach((child) => {
      if (child instanceof THREE.Sprite) {
        child.lookAt(pyramidCamera.position);
      }
    });

    pyramidRenderer.render(pyramidScene, pyramidCamera);
  }

  animate();
}





/* ===========================================
   TAGS CLICÁVEIS + SINCRONIZAÇÃO
=========================================== */

const btnBase = document.getElementById("btn-base");
const btnMeio = document.getElementById("btn-meio");
const btnTopo = document.getElementById("btn-topo");
const currentClassLabel = document.getElementById("current-class-label");

function limparSelecaoTexto() {
  [btnBase, btnMeio, btnTopo].forEach((b) => {
    if (!b) return;
    b.classList.remove("active-tag");
  });
}

function aplicarGlowTexto(classe) {
  limparSelecaoTexto();
  const map = { base: btnBase, meio: btnMeio, topo: btnTopo };
  const btn = map[classe];
  if (btn) btn.classList.add("active-tag");
}

function atualizarLabelClasse() {
  if (!currentClassLabel) return;
  if (classeEscolhida === "base")
    currentClassLabel.textContent = "Base — chão de fábrica";
  else if (classeEscolhida === "meio")
    currentClassLabel.textContent = "Meio — coordenação";
  else if (classeEscolhida === "topo")
    currentClassLabel.textContent = "Topo — diretoria";
  else currentClassLabel.textContent = "nenhuma";
}

function selecionarClasse(classe, meshFrom3D) {
  classeEscolhida = classe;
  aplicarGlowTexto(classe);
  atualizarLabelClasse();

  if (meshFrom3D) {
    setSelectedMesh(meshFrom3D);
  } else if (pyramidGroup) {
    const alvo = pyramidGroup.children.find(
      (m) => m.userData && m.userData.classe === classe
    );
    if (alvo) setSelectedMesh(alvo);
  }

  closeClassModal();

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

if (btnBase) btnBase.addEventListener("click", () => selecionarClasse("base"));
if (btnMeio) btnMeio.addEventListener("click", () => selecionarClasse("meio"));
if (btnTopo) btnTopo.addEventListener("click", () => selecionarClasse("topo"));

/* ===========================================
   POSTAR
=========================================== */

const postText = document.getElementById("post-text");
const postError = document.getElementById("post-error");
const btnPostar = document.getElementById("btn-postar");
const btnEscolherClasse = document.getElementById("btn-escolher-classe");
const btnAtualizar = document.getElementById("btn-atualizar");

if (btnEscolherClasse) {
  btnEscolherClasse.addEventListener("click", () => {
    openClassModal();
  });
}

if (btnAtualizar) {
  btnAtualizar.addEventListener("click", () => {
    carregarPosts();
  });
}

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
    if (!postText) return;
    const texto = postText.value.trim();
    if (!texto) {
      if (postError) postError.textContent = "Digite algo.";
      return;
    }
    if (!classeEscolhida) {
      if (postError)
        postError.textContent =
          "Escolha sua posição na pirâmide antes de postar.";
      acaoPendente = { tipo: "post", texto };
      openClassModal();
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
  feedEl.textContent = "Carregando...";
  try {
    const r = await fetch(`${API}/api/posts`);
    const posts = await r.json();
    if (!Array.isArray(posts)) throw new Error("Formato inesperado");
    renderFeed(posts);
  } catch (err) {
    console.error("Erro ao carregar posts:", err);
    feedEl.textContent = "Erro ao carregar posts.";
  }
}

function renderFeed(posts) {
  feedEl.innerHTML = "";
  posts.forEach((p) => {
    const el = document.createElement("div");
    el.className = "post";

    const upvotes = p.upvotes || 0;
    const repliesCount = p.replies_count || 0;

    el.innerHTML = `
      <div class="post-header">
        <div class="avatar" style="background:${p.cor_classe || "#4b5563"}">
          ${p.avatar && p.avatar.emoji ? escapeHtml(p.avatar.emoji) : "😶"}
        </div>
        <div class="post-header-info">
          <div class="alias">${escapeHtml(p.alias || "Anônimo")}</div>
          <div class="meta-line">${new Date(p.created_at).toLocaleString(
            "pt-BR"
          )}</div>
        </div>
      </div>

      <div class="post-text">
        ${highlightTags(p.texto || "")}
      </div>

      <div class="post-actions">
        <button class="like-btn">
          <span>▲</span>
          <span class="like-label">${upvotes}</span>
        </button>

        <button class="report-btn">
          🚩 Denunciar
        </button>

        <button class="ver-respostas">
          Ver respostas (${repliesCount})
        </button>
      </div>

      <div class="reply-box">
        <textarea class="reply-textarea" placeholder="Responder..."></textarea>
        <button class="reply-send">Enviar</button>
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
        if (!js.error && typeof js.upvotes !== "undefined") {
          likeLabel.textContent = js.upvotes;
        } else if (js.error) {
          alert(js.error);
        }
      } catch (e) {
        console.error(e);
        alert("Erro ao votar.");
      } finally {
        likeBtn.disabled = false;
      }
    });

    // report
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
        if (js.error) alert(js.error);
        else alert("Denúncia registrada. Obrigado pelo aviso.");
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
    const replyBtn = el.querySelector(".reply-send");
    const replyTextarea = el.querySelector(".reply-textarea");

    btnToggle.addEventListener("click", () => {
      const isOpen = box.style.display === "block";
      box.style.display = isOpen ? "none" : "block";
      if (!isOpen) carregarRespostas(p.id, el);
    });

    replyBtn.addEventListener("click", () => {
      const texto = replyTextarea.value.trim();
      if (!texto) return;
      if (!classeEscolhida) {
        if (postError)
          postError.textContent =
            "Escolha sua posição na pirâmide para responder.";
        acaoPendente = {
          tipo: "reply",
          texto,
          postId: p.id,
          textarea: replyTextarea,
          postEl: el
        };
        openClassModal();
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
  const btn = postEl.querySelector(".reply-send");
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
    const data = await r.json();
    const replies = Array.isArray(data)
      ? data
      : Array.isArray(data.replies)
      ? data.replies
      : [];

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
    postEl.querySelector(".replies").textContent =
      "Erro ao carregar respostas.";
  }
}

/* ===========================================
   AJUDA
=========================================== */

const helpBtn = document.querySelector(".floating-help");
if (helpBtn) {
  helpBtn.addEventListener("click", () => {
    alert(
      "Este espaço é anônimo. As postagens são associadas apenas à posição na pirâmide (base, meio ou topo), nunca à sua identidade."
    );
  });
}
