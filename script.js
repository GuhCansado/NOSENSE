const API = "/api";

/* ===========================================
   UTILIDADES
=========================================== */

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[c]));
}

function highlightTags(text) {
    return escapeHtml(text).replace(/#([\p{L}\p{N}_-]+)/gu, '<span class="tag">#$1</span>');
}

function extractTags(text) {
    const matches = text.match(/#([\p{L}\p{N}_-]+)/gu) || [];
    return matches.map(t => t.slice(1).toLowerCase());
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
        await r.json();

        dot.className = "status-dot online";
        txt.textContent = "Servidor Online";
    } catch {
        dot.className = "status-dot offline";
        txt.textContent = "Servidor Offline";
    }
}

setInterval(atualizarStatus, 5000);
atualizarStatus();

/* ===========================================
   TEMA CLARO / ESCURO
=========================================== */

const themeToggle = document.getElementById("theme-toggle");
const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
const savedTheme = localStorage.getItem("vozes_theme");

function applyTheme(theme) {
    const body = document.body;
    if (theme === "light") {
        body.classList.remove("theme-dark");
        body.classList.add("theme-light");
        themeToggle.textContent = "☀️";
    } else {
        body.classList.remove("theme-light");
        body.classList.add("theme-dark");
        themeToggle.textContent = "🌙";
    }
    localStorage.setItem("vozes_theme", theme);
}

applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

themeToggle.addEventListener("click", () => {
    const current = document.body.classList.contains("theme-light") ? "light" : "dark";
    applyTheme(current === "light" ? "dark" : "light");
});

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

pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(poly => {
    poly.addEventListener("click", () => {
        pyramidSvg.querySelectorAll("polygon[data-classe]").forEach(p => p.classList.remove("selected"));
        poly.classList.add("selected");
        classeEscolhida = poly.dataset.classe;
        classModal.classList.remove("show");
        btnPostar.disabled = false;
    });
});

/* ===========================================
   AJUDA ( ? )
=========================================== */

const helpBtn = document.getElementById("help-btn");
const helpModal = document.getElementById("help-modal");
const helpClose = document.getElementById("help-close");

helpBtn.onclick = () => helpModal.classList.add("show");
helpClose.onclick = () => helpModal.classList.remove("show");

/* ===========================================
   VOTOS & DENÚNCIAS (LOCALSTORAGE)
=========================================== */

const votesStoreKey = "vozes_votes";
const reportsStoreKey = "vozes_reports";

function getVotesStore() {
    try {
        return JSON.parse(localStorage.getItem(votesStoreKey)) || {};
    } catch {
        return {};
    }
}

function saveVotesStore(store) {
    localStorage.setItem(votesStoreKey, JSON.stringify(store));
}

function getReportsStore() {
    try {
        return JSON.parse(localStorage.getItem(reportsStoreKey)) || {};
    } catch {
        return {};
    }
}

function saveReportsStore(store) {
    localStorage.setItem(reportsStoreKey, JSON.stringify(store));
}

/* ===========================================
   POSTAR INDIGNAÇÃO
=========================================== */

const postText = document.getElementById("post-text");
const postError = document.getElementById("post-error");
const btnReload = document.getElementById("btn-reload");

let bloqueandoPost = false;

btnPostar.addEventListener("click", async () => {
    const texto = postText.value.trim();
    postError.textContent = "";

    if (!texto) {
        postError.textContent = "Digite algo antes de postar.";
        return;
    }

    if (!classeEscolhida) {
        postError.textContent = "Escolha sua posição na pirâmide.";
        return;
    }

    if (bloqueandoPost) return;
    bloqueandoPost = true;
    btnPostar.disabled = true;

    try {
        const r = await fetch(`${API}/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ texto, classe: classeEscolhida })
        });

        const js = await r.json();

        if (!r.ok || js.error) {
            postError.textContent = js.error || "Erro ao criar postagem.";
        } else {
            postText.value = "";
            classeEscolhida = null;
            carregarPosts();
        }
    } catch {
        postError.textContent = "Erro ao conectar com o servidor.";
    }

    bloqueandoPost = false;
});

/* botão manual de atualizar */
btnReload.addEventListener("click", () => carregarPosts());

/* ===========================================
   FEED + ASSUNTOS QUENTES
=========================================== */

const feedEl = document.getElementById("feed");
const topicsEl = document.getElementById("top-topics");

async function carregarPosts() {
    feedEl.innerHTML = '<div class="loading">Carregando...</div>';

    try {
        const r = await fetch(`${API}/posts`);
        const posts = await r.json();

        renderFeed(posts);
        atualizarTopicos(posts);
    } catch {
        feedEl.innerHTML = '<div class="loading">Erro ao carregar feed.</div>';
    }
}

function atualizarTopicos(posts) {
    const contagem = {};

    posts.forEach(p => {
        const tags = extractTags(p.texto || "");
        tags.forEach(tag => {
            contagem[tag] = (contagem[tag] || 0) + 1;
        });
    });

    topicsEl.innerHTML = "";

    const ordenados = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2);

    if (!ordenados.length) {
        topicsEl.innerHTML =
            '<span class="topic-pill empty">Sem assuntos ainda. Use hashtags como #exausto, #chefia, #metas...</span>';
        return;
    }

    ordenados.forEach(([tag, count]) => {
        const span = document.createElement("span");
        span.className = "topic-pill";
        span.textContent = `🔥 #${tag} (${count})`;
        topicsEl.appendChild(span);
    });
}

function renderFeed(posts) {
    const votesStore = getVotesStore();
    const reportsStore = getReportsStore();
    feedEl.innerHTML = "";

    if (!posts.length) {
        feedEl.innerHTML = '<div class="loading">Nenhum desabafo ainda.</div>';
        return;
    }

    posts.forEach(p => {
        const postDiv = document.createElement("div");
        postDiv.className = "post";

        const userVote = votesStore[p.id] || 0;
        const upCount = (p.upvotes || 0) + (userVote === 1 ? 1 : 0);
        const downCount = (p.downvotes || 0) + (userVote === -1 ? 1 : 0);
        const reported = !!reportsStore[p.id];

        postDiv.innerHTML = `
            <div style="display:flex; gap:12px; align-items:center;">
                <div class="avatar" style="background:${p.cor_classe}">
                    ${p.avatar?.emoji || "😐"}
                </div>

                <div>
                    <div class="alias">${p.alias || "Anônimo"}</div>
                    <div class="meta-line">
                        ${new Date(p.created_at).toLocaleString("pt-BR")}
                        • ${p.classe_label || ""}
                    </div>
                </div>
            </div>

            <div class="post-text">${highlightTags(p.texto || "")}</div>

            <div class="post-actions">
                <button class="secondary small-btn vote-btn upvote ${userVote === 1 ? "active" : ""}">
                    👍 <span class="vote-count">${upCount}</span>
                </button>
                <button class="secondary small-btn vote-btn downvote ${userVote === -1 ? "active" : ""}">
                    👎 <span class="vote-count">${downCount}</span>
                </button>
                <button class="secondary small-btn report-btn ${reported ? "reported" : ""}">
                    ${reported ? "🚩 Denunciado" : "🚩 Denunciar"}
                </button>
                <button class="secondary small-btn ver-respostas">
                    Ver respostas (${p.replies_count || 0})
                </button>
            </div>

            <div class="reply-box">
                <textarea class="reply-textarea" rows="2" placeholder="Escreva sua resposta..."></textarea>
                <div style="margin-top:6px; display:flex; gap:6px;">
                    <button class="primary small-btn responder-btn">Responder</button>
                </div>
                <div class="replies"></div>
            </div>
        `;

        /* --- VOTAÇÃO --- */
        const upBtn = postDiv.querySelector(".upvote");
        const downBtn = postDiv.querySelector(".downvote");
        const reportBtn = postDiv.querySelector(".report-btn");

        const upCountEl = upBtn.querySelector(".vote-count");
        const downCountEl = downBtn.querySelector(".vote-count");

        upBtn.addEventListener("click", () => {
            const store = getVotesStore();
            const current = store[p.id] || 0;

            if (current === 1) {
                store[p.id] = 0;
            } else {
                store[p.id] = 1;
            }
            saveVotesStore(store);
            renderFeed(posts); // re-render rápido
        });

        downBtn.addEventListener("click", () => {
            const store = getVotesStore();
            const current = store[p.id] || 0;

            if (current === -1) {
                store[p.id] = 0;
            } else {
                store[p.id] = -1;
            }
            saveVotesStore(store);
            renderFeed(posts);
        });

        /* --- DENÚNCIA --- */
        reportBtn.addEventListener("click", () => {
            const store = getReportsStore();
            if (store[p.id]) return; // já denunciado

            store[p.id] = true;
            saveReportsStore(store);
            reportBtn.classList.add("reported");
            reportBtn.textContent = "🚩 Denunciado";
        });

        /* --- RESPONDER / ANIMAÇÃO --- */
        const replyBox = postDiv.querySelector(".reply-box");
        const toggleRepliesBtn = postDiv.querySelector(".ver-respostas");
        const replyTextarea = postDiv.querySelector(".reply-textarea");
        const responderBtn = postDiv.querySelector(".responder-btn");

        let respostasCarregadas = false;

        toggleRepliesBtn.addEventListener("click", async () => {
            const isOpen = replyBox.classList.contains("open");
            if (isOpen) {
                replyBox.classList.remove("open");
                toggleRepliesBtn.textContent = `Ver respostas (${p.replies_count || 0})`;
            } else {
                replyBox.classList.add("open");
                toggleRepliesBtn.textContent = "Esconder respostas";
                if (!respostasCarregadas) {
                    await carregarRespostas(p.id, postDiv);
                    respostasCarregadas = true;
                }
            }
        });

        responderBtn.addEventListener("click", async () => {
            const texto = replyTextarea.value.trim();
            if (!texto) return;

            responderBtn.disabled = true;

            try {
                const r = await fetch(`${API}/posts/${p.id}/replies`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ texto, classe: p.classe })
                });

                const js = await r.json();

                if (!r.ok || js.error) {
                    alert(js.error || "Erro ao responder.");
                } else {
                    replyTextarea.value = "";
                    await carregarRespostas(p.id, postDiv);
                }

            } catch {
                alert("Erro ao conectar com o servidor.");
            }

            responderBtn.disabled = false;
        });

        feedEl.appendChild(postDiv);
    });
}

async function carregarRespostas(postId, postDiv) {
    try {
        const r = await fetch(`${API}/posts/${postId}/replies`);
        const replies = await r.json();

        const box = postDiv.querySelector(".replies");
        box.innerHTML = "";

        if (!replies.length) {
            box.innerHTML = '<div class="loading">Nenhuma resposta ainda.</div>';
            return;
        }

        replies.forEach(rp => {
            const el = document.createElement("div");
            el.className = "reply";
            el.innerHTML = `
                <div class="reply-header">
                    <span class="reply-alias">${rp.alias}</span>
                    <span class="meta-line">
                        ${new Date(rp.created_at).toLocaleString("pt-BR")}
                    </span>
                </div>
                <div class="reply-text">${highlightTags(rp.texto || "")}</div>
            `;
            box.appendChild(el);
        });
    } catch {
        const box = postDiv.querySelector(".replies");
        box.innerHTML = '<div class="loading">Erro ao carregar respostas.</div>';
    }
}

/* ===========================================
   WEBSOCKET (OPCIONAL) + POLLING
=========================================== */

let ws;

function initWebSocket() {
    try {
        const proto = location.protocol === "https:" ? "wss" : "ws";
        const url = `${proto}://${location.host}/ws`;
        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log("WebSocket conectado.");
        };

        ws.onmessage = (ev) => {
            // qualquer mensagem do servidor dispara reload do feed
            if (ev.data) {
                carregarPosts();
            }
        };

        ws.onerror = () => {
            console.log("Erro no WebSocket, usando apenas polling.");
        };

        ws.onclose = () => {
            console.log("WebSocket fechado.");
        };
    } catch (e) {
        console.log("WebSocket indisponível.", e);
    }
}

/* fallback de polling */
setInterval(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        carregarPosts();
    }
}, 20000); // 20s

// Inicial
carregarPosts();
initWebSocket();
