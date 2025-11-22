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

  pyramidScene = new THREE.Scene();
  pyramidScene.background = new THREE.Color(0x020617);

  const rect = pyramidCanvas.getBoundingClientRect();
  const w = rect.width || 400;
  const h = rect.height || 260;

  pyramidCamera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
  pyramidCamera.position.set(0, 1.1, 5.1);
  pyramidCamera.lookAt(0, 0.55, 0);

  pyramidRenderer = new THREE.WebGLRenderer({
    canvas: pyramidCanvas,
    antialias: true,
    alpha: true
  });
  pyramidRenderer.setPixelRatio(window.devicePixelRatio || 1);
  pyramidRenderer.setSize(w, h, false);

  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  pyramidScene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.95);
  dir.position.set(3, 5, 4);
  pyramidScene.add(dir);

  const point = new THREE.PointLight(0x7c7bff, 1.4, 12);
  point.position.set(-2.2, 3.2, 3.5);
  pyramidScene.add(point);

  pyramidGroup = new THREE.Group();
  pyramidScene.add(pyramidGroup);

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x22c55e,
    metalness: 0.45,
    roughness: 0.3,
    emissive: 0x16351f,
    emissiveIntensity: 0.3
  });
  const middleMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.48,
    roughness: 0.3,
    emissive: 0x102b4f,
    emissiveIntensity: 0.3
  });
  const topMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.52,
    roughness: 0.28,
    emissive: 0x3b1111,
    emissiveIntensity: 0.3
  });

  function createSegment(widthTop, widthBottom, height, mat, classe, y) {
    const geo = new THREE.CylinderGeometry(
      widthTop,
      widthBottom,
      height,
      4,
      1,
      false
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.y = Math.PI / 4;
    mesh.position.y = y;
    mesh.userData.classe = classe;
    pyramidGroup.add(mesh);
    return mesh;
  }

  const sliceHeight = 0.75;
  createSegment(1.7, 2.4, sliceHeight, baseMat, "base", -sliceHeight);
  createSegment(1.2, 1.7, sliceHeight, middleMat, "meio", 0);
  createSegment(0.6, 1.2, sliceHeight, topMat, "topo", sliceHeight);

  pyramidGroup.rotation.x = THREE.MathUtils.degToRad(12);
  pyramidGroup.rotation.y = targetRotY;
  pyramidGroup.position.y = 0.55;

  pyramidRaycaster = new THREE.Raycaster();
  pyramidMouse = new THREE.Vector2();

  function handlePointerMove(e) {
    const r = pyramidCanvas.getBoundingClientRect();
    pyramidMouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pyramidMouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;

    const normalizedX = (e.clientX - r.left) / r.width - 0.5;
    targetRotY = -0.35 + normalizedX * 0.35;

    pyramidRaycaster.setFromCamera(pyramidMouse, pyramidCamera);
    const intersects = pyramidRaycaster.intersectObjects(
      pyramidGroup.children
    );
    if (intersects.length > 0) {
      setHoveredMesh(intersects[0].object);
    } else {
      setHoveredMesh(null);
    }
  }

  function handleClick(e) {
    const r = pyramidCanvas.getBoundingClientRect();
    pyramidMouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pyramidMouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;

    pyramidRaycaster.setFromCamera(pyramidMouse, pyramidCamera);
    const intersects = pyramidRaycaster.intersectObjects(
      pyramidGroup.children
    );
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const classe = mesh.userData.classe;
      if (classe) {
        selecionarClasse(classe, mesh);
      }
    }
  }

  pyramidCanvas.addEventListener("mousemove", handlePointerMove);
  pyramidCanvas.addEventListener("click", handleClick);
  window.addEventListener("resize", resizePyramid);

  function animate() {
    requestAnimationFrame(animate);
    currentRotY += (targetRotY - currentRotY) * 0.08;
    if (pyramidGroup) {
      pyramidGroup.rotation.y = currentRotY;
    }
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
    if (!b) retur
