/* ===========================================
    BUSCAR URL DA API VIA GITHUB
=========================================== */

let API = null;

async function loadApiFromGithub() {
    try {
        const r = await fetch(
            "https://raw.githubusercontent.com/GuhCansado/NOSENSE/main/server_status.json"
        );

        const js = await r.json();

        API = js.url_api_base + "/api";

        console.log("✅ API carregada:", API);

        iniciarSistema(); // só inicia o site depois disso

    } catch (e) {
        console.error("❌ Erro ao carregar server_status.json", e);
        document.body.innerHTML = `
            <div style="padding:20px;color:red;font-size:20px;">
                Erro ao carregar servidor.<br>Verifique o server_status.json.
            </div>
        `;
    }
}

loadApiFromGithub();

/* ===========================================
    SISTEMA PRINCIPAL — só roda quando API existe
=========================================== */
function iniciarSistema() {

/* ===========================================
   UTILIDADES
=========================================== */
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
}

function highlightTags(text) {
    return escapeHtml(text).replace(
        /#([\p{L}\p{N}_-]+)/gu,
        '<span class="tag">#$1</span>'
    );
}

function extractTags(text) {
    const matches = text.match(/#([\p{L}\p{N}_-]+)/gu) || [];
    return matches.map((t) => t.slice(1).toLowerCase());
}

/* ===========================================
   STATUS DO SERVIDOR
=========================================== */

async function atualizarStatus() {
    const dot = document.getElementById("status-dot");
    const txt = document.getElementById("status-text");

    try {
        const r = await fetch(`${API}/status`);
        if (!r.ok) throw new Error();

        dot.className = "status-dot online";
        txt.textContent = "Servidor Online";

    } catch {
        dot.className = "status-dot offline";
        txt.textContent = "Servidor Offline";
    }
}

setInterval(atualizarStatus, 5000);

/* ===========================================
   MODAL DA PIRÂMIDE
=========================================== */

const classModal = document.getElementById("class-modal-backdrop");
const btnEscolher = document.getElementById("btn-escolher-classe");
const modalClose = document.getElementById("modal-close");
const pyramidSvg = document.getElementById("pyramid-svg");
const btnPostar = document.getElementById("btn-postar");

let classeEscolhida = null;

btnEscolher.onclick = () => classModal.classList.add("show");
modalClose.onclick = () => classModal.classList.remove("show");

pyramidSvg
    .querySelectorAll("polygon[data-classe]")
    .forEach((poly) => {
        poly.addEventListener("click", () => {
            pyramidSvg
                .querySelectorAll("polygon[data-classe]")
                .forEach((p) => p.classList.remove("selected"));

            poly.classList.add("selected");
            classeEscolhida = poly.dataset.classe;
            classModal.classList.remove("show");

            btnPostar.disabled = false;
        });
    });

/* ===========================================
   AJUDA ( ? )
=========================================== */

document.getElementById("help-btn").onclick = () =>
    document.getElementById("help-modal").classList.add("show");

document.getElementById("help-close").onclick = () =>
    document.getElementById("help-modal").classList.remove("show");

/* ===========================================
   POSTAR INDIGNAÇÃO
=========================================== */

const postText = document.getElementById("post-text");
const postError = document.getElementById("post-error");
const btnReload = document.getElementById("btn-reload");

btnPostar.addEventListener("click", async () => {
    const texto = postText.value.trim();
    postError.textContent = "";

    if (!texto) {
        postError.textContent = "Digite algo antes de postar.";
        return;
    }
    if (!classeEscolhida) {
        postError.textContent = "Escolha a sua posição na pirâmide.";
        return;
    }

    try {
        const r = await fetch(`${API}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto, classe: classeEscolhida }),
        });

        const js = await r.json();

        if (!r.ok || js.error) {
            postError.textContent = js.error || "Erro ao postar.";
        } else {
            postText.value = "";
            classeEscolhida = null;
            carregarPosts();
        }
    } catch {
        postError.textContent = "Erro ao conectar com o servidor.";
    }
});

/* ===========================================
   FEED
=========================================== */

const feedEl = document.getElementById("feed");
const topicsEl = document.getElementById("top-topics");

async function carregarPosts() {
    feedEl.innerHTML = `<div class="loading">Carregando...</div>`;

    try {
        const r = await fetch(`${API}/posts`);
        const posts = await r.json();

        renderFeed(posts);
        atualizarTopicos(posts);

    } catch {
        feedEl.innerHTML = `<div class="loading">Erro ao carregar.</div>`;
    }
}

function atualizarTopicos(posts) {
    const counts = {};
    posts.forEach((p) => {
        extractTags(p.texto || "").forEach((t) => {
            counts[t] = (counts[t] || 0) + 1;
        });
    });

    topicsEl.innerHTML = "";

    const hot = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

    if (!hot.length) {
        topicsEl.innerHTML =
            '<span class="topic-pill empty">Sem assuntos ainda.</span>';
        return;
    }

    hot.forEach(([tag, n]) => {
        const el = document.createElement("span");
        el.className = "topic-pill";
        el.textContent = `🔥 #${tag} (${n})`;
        topicsEl.appendChild(el);
    });
}

function renderFeed(posts) {
    feedEl.innerHTML = "";

    if (!posts.length) {
        feedEl.innerHTML = `<div class="loading">Nenhum desabafo ainda.</div>`;
        return;
    }

    posts.forEach((p) => {
        const div = document.createElement("div");
        div.className = "post";

        div.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background:${p.cor_classe}">
                    ${p.avatar?.emoji || "😐"}
                </div>

                <div>
                    <div class="alias">${p.alias}</div>
                    <div class="meta-line">
                        ${new Date(p.created_at).toLocaleString("pt-BR")} •
                        ${p.classe_label}
                    </div>
                </div>
            </div>

            <div class="post-text">${highlightTags(p.texto)}</div>

            <button class="secondary small-btn ver-respostas">
                Ver respostas (${p.replies_count || 0})
            </button>

            <div class="reply-box">
                <textarea class="reply-textarea" rows="2"></textarea>
                <button class="primary small-btn responder-btn">Responder</button>
                <div class="replies"></div>
            </div>
        `;

        const replyBox = div.querySelector(".reply-box");
        const btnToggle = div.querySelector(".ver-respostas");
        const textarea = div.querySelector(".reply-textarea");

        btnToggle.onclick = async () => {
            if (replyBox.classList.contains("open")) {
                replyBox.classList.remove("open");
                btnToggle.textContent = `Ver respostas (${p.replies_count})`;
            } else {
                replyBox.classList.add("open");
                btnToggle.textContent = "Esconder respostas";
                await carregarRespostas(p.id, div);
            }
        };

        div.querySelector(".responder-btn").onclick = async () => {
            const texto = textarea.value.trim();
            if (!texto) return;

            textarea.value = "";

            await fetch(`${API}/posts/${p.id}/replies`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto, classe: p.classe }),
            });

            await carregarRespostas(p.id, div);
        };

        feedEl.appendChild(div);
    });
}

async function carregarRespostas(id, div) {
    const box = div.querySelector(".replies");
    box.innerHTML = `<div class="loading">Carregando...</div>`;

    try {
        const r = await fetch(`${API}/posts/${id}/replies`);
        const replies = await r.json();

        box.innerHTML = "";
        replies.forEach((rp) => {
            const el = document.createElement("div");
            el.className = "reply";
            el.innerHTML = `
                <div class="reply-header">
                    <span class="reply-alias">${rp.alias}</span>
                    <span class="meta-line">${new Date(
                        rp.created_at
                    ).toLocaleString("pt-BR")}</span>
                </div>
                <div class="reply-text">${highlightTags(rp.texto)}</div>
            `;
            box.appendChild(el);
        });
    } catch {
        box.innerHTML = `<div class="loading">Erro ao carregar.</div>`;
    }
}

/* Inicializa */
carregarPosts();

}
