// ===============================
//  CONFIG E ELEMENTOS BÁSICOS
// ===============================

let API_BASE = null;
let API_STATUS = "offline";
let API_VERSION = "--";

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const versionText = document.getElementById("version-text");
const errorGlobal = document.getElementById("error-global");

const postTextEl = document.getElementById("post-text");
const btnPost = document.getElementById("btn-post");
const feedEl = document.getElementById("feed");
const feedEmptyEl = document.getElementById("feed-empty");

// modal classe/pirâmide
const classModalBackdrop = document.getElementById("class-modal-backdrop");
const pyramidSvg = document.getElementById("pyramid-svg");
const modalCloseBtn = document.getElementById("modal-close");

// modal ajuda
const helpModalBackdrop = document.getElementById("help-modal-backdrop");
const helpModalClose = document.getElementById("help-modal-close");
const helpButton = document.getElementById("help-button");

let stagedText = "";

// ===============================
//  CARREGAR CONFIG (GitHub RAW)
// ===============================

async function carregarConfig() {
    try {
        const resp = await fetch(
            "https://raw.githubusercontent.com/GuhCansado/NOSENSE/main/server_status.json?cache=" + Date.now()
        );

        if (!resp.ok) throw new Error("Falha ao carregar server_status.json");

        const data = await resp.json();

        API_BASE = data.url_api_base;
        API_VERSION = data.version_api || "--";

        const online = data.status_servidor === "Online";
        setStatus(online, API_VERSION);

        if (online) {
            await carregarFeed();
        } else {
            feedEmptyEl.style.display = "block";
        }
    } catch (err) {
        console.error(err);
        errorGlobal.style.display = "block";
        errorGlobal.textContent = "Erro ao ler o server_status.json do GitHub.";
        setStatus(false, "--");
    }
}

// ===============================
//  STATUS VISUAL
// ===============================

function setStatus(online, version) {
    API_STATUS = online ? "online" : "offline";

    statusDot.classList.remove("online", "offline");
    statusDot.classList.add(online ? "online" : "offline");

    statusText.textContent = online ? "Servidor Online" : "Servidor Offline";
    versionText.textContent = "API: " + (version || "--");

    btnPost.disabled = !online;
}

// ===============================
//  FEED
// ===============================

async function carregarFeed() {
    if (!API_BASE) return;

    try {
        const resp = await fetch(API_BASE + "/api/posts");
        if (!resp.ok) throw new Error("Erro ao buscar posts");

        const posts = await resp.json();
        renderFeed(posts);
    } catch (err) {
        console.error(err);
        errorGlobal.style.display = "block";
        errorGlobal.textContent = "Erro ao carregar o feed.";
    }
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[c]));
}

function renderFeed(posts) {
    feedEl.innerHTML = "";

    if (!posts || posts.length === 0) {
        feedEmptyEl.style.display = "block";
        return;
    }

    feedEmptyEl.style.display = "none";

    posts.forEach((post) => {
        const postDiv = document.createElement("div");
        postDiv.className = "post";
        postDiv.dataset.postId = post.id;

        const avatarBg = (post.avatar && post.avatar.bg_color) || "#4b5563";
        const avatarEmoji = (post.avatar && post.avatar.emoji) || "🙂";

        const dataStr = new Date(post.created_at).toLocaleString("pt-BR");

        postDiv.innerHTML = `
            <div class="post-header">
                <div class="avatar" style="background:${avatarBg};">
                    <span class="avatar-emoji">${avatarEmoji}</span>
                </div>

                <div class="post-meta">
                    <div class="alias">${post.alias || "Anônimo"}</div>
                    <div class="meta-line">
                        <span>${post.classe_label}</span>
                        <span>•</span>
                        <span>${dataStr}</span>
                        <span>•</span>
                        <span>${post.replies_count || 0} respostas</span>
                    </div>
                </div>
            </div>

            <div class="post-text">${escapeHtml(post.texto)}</div>

            <div class="post-footer">
                <button class="small-btn secondary btn-toggle-replies">Ver respostas</button>
            </div>

            <div class="reply-box">
                <div class="reply-label">Responder anonimamente</div>
                <textarea class="reply-textarea" rows="2" placeholder="Escreva sua resposta..."></textarea>
                <div class="reply-actions">
                    <button class="small-btn primary btn-reply">Responder</button>
                </div>
                <div class="error-msg reply-error" style="display:none;"></div>
                <div class="replies"></div>
            </div>
        `;

        const btnToggle = postDiv.querySelector(".btn-toggle-replies");
        const replyBox = postDiv.querySelector(".reply-box");
        const repliesDiv = postDiv.querySelector(".replies");
        const btnReply = postDiv.querySelector(".btn-reply");
        const replyTA = postDiv.querySelector(".reply-textarea");
        const replyError = postDiv.querySelector(".reply-error");

        // Abrir/fechar replies + caixa de resposta
        btnToggle.addEventListener("click", async () => {
            const isHidden = replyBox.style.display === "none" || replyBox.style.display === "";
            if (isHidden) {
                replyBox.style.display = "block";
                btnToggle.textContent = "Esconder respostas";
                await carregarReplies(postDiv, post.id);
            } else {
                replyBox.style.display = "none";
                btnToggle.textContent = "Ver respostas";
            }
        });

        // Enviar resposta
        btnReply.addEventListener("click", () => {
            const text = replyTA.value.trim();
            if (!text) {
                replyError.style.display = "block";
                replyError.textContent = "Digite algo.";
                return;
            }
            replyError.style.display = "none";

            stagedText = text;
            openClassModal(async (classe) => {
                await enviarReply(post.id, stagedText, classe, replyError, replyTA, postDiv);
            });
        });

        feedEl.appendChild(postDiv);
    });
}

// ===============================
//  REPLIES
// ===============================

async function carregarReplies(postDiv, postId) {
    const repliesDiv = postDiv.querySelector(".replies");
    repliesDiv.innerHTML = "";

    try {
        const resp = await fetch(API_BASE + "/api/posts/" + postId + "/replies");
        const replies = await resp.json();

        if (!replies || replies.length === 0) {
            repliesDiv.innerHTML =
                `<div class="empty-state" style="padding:4px 0;">Nenhuma resposta ainda.</div>`;
            return;
        }

        replies.forEach((r) => {
            const avatarBg = (r.avatar && r.avatar.bg_color) || "#4b5563";
            const avatarEmoji = (r.avatar && r.avatar.emoji) || "🙂";

            const replyEl = document.createElement("div");
            replyEl.className = "reply";

            replyEl.innerHTML = `
                <div class="reply-header">
                    <div class="avatar" style="width:32px;height:32px;background:${avatarBg};">
                        <span class="avatar-emoji" style="font-size:1.5rem;">${avatarEmoji}</span>
                    </div>
                    <div>
                        <div class="reply-alias">${r.alias}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted);">
                            ${new Date(r.created_at).toLocaleString("pt-BR")}
                        </div>
                    </div>
                </div>
                <div class="reply-text">${escapeHtml(r.texto)}</div>
            `;

            repliesDiv.appendChild(replyEl);
        });
    } catch (err) {
        repliesDiv.innerHTML = `<div class="error-msg">Erro ao carregar respostas.</div>`;
    }
}

async function enviarReply(postId, texto, classe, replyError, replyTA, postDiv) {
    try {
        const resp = await fetch(API_BASE + "/api/posts/" + postId + "/replies", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ texto, classe })
        });

        const data = await resp.json();

        if (!resp.ok) {
            replyError.style.display = "block";
            replyError.textContent = data.error || "Erro ao responder.";
            return;
        }

        replyTA.value = "";
        await carregarReplies(postDiv, postId);
        await carregarFeed();
    } catch (err) {
        replyError.style.display = "block";
        replyError.textContent = "Erro ao conectar com o servidor.";
    }
}

// ===============================
//  NOVO POST
// ===============================

btnPost.addEventListener("click", () => {
    errorGlobal.style.display = "none";

    const texto = postTextEl.value.trim();

    if (!texto) {
        errorGlobal.style.display = "block";
        errorGlobal.textContent = "Escreva algo.";
        return;
    }

    if (!API_BASE || API_STATUS !== "online") {
        errorGlobal.style.display = "block";
        errorGlobal.textContent = "Servidor Offline.";
        return;
    }

    stagedText = texto;
    openClassModal(async (classe) => {
        await enviarPost(stagedText, classe);
    });
});

async function enviarPost(texto, classe) {
    btnPost.disabled = true;

    try {
        const resp = await fetch(API_BASE + "/api/posts", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ texto, classe })
        });

        const data = await resp.json();

        if (!resp.ok) {
            errorGlobal.style.display = "block";
            errorGlobal.textContent = data.error || "Erro ao criar postagem.";
        } else {
            postTextEl.value = "";
            await carregarFeed();
        }
    } catch (err) {
        errorGlobal.style.display = "block";
        errorGlobal.textContent = "Erro ao conectar.";
    }

    btnPost.disabled = false;
}

// ===============================
//  MODAL DA PIRÂMIDE (CLASSE)
// ===============================

function openClassModal(onSelect) {
    // limpa seleção
    const layers = pyramidSvg.querySelectorAll("polygon[data-classe]");
    layers.forEach((el) => el.classList.remove("selected"));

    classModalBackdrop.classList.add("show");

    const handler = async (e) => {
        const target = e.target.closest("polygon[data-classe]");
        if (!target) return;

        layers.forEach((el) => el.classList.remove("selected"));
        target.classList.add("selected");

        const classe = target.getAttribute("data-classe");

        setTimeout(() => {
            closeClassModal();
            if (onSelect) onSelect(classe);
        }, 140);
    };

    pyramidSvg._handler = handler;
    pyramidSvg.addEventListener("click", handler);
}

function closeClassModal() {
    classModalBackdrop.classList.remove("show");

    if (pyramidSvg._handler) {
        pyramidSvg.removeEventListener("click", pyramidSvg._handler);
        pyramidSvg._handler = null;
    }
}

modalCloseBtn.addEventListener("click", closeClassModal);

classModalBackdrop.addEventListener("click", (e) => {
    if (e.target === classModalBackdrop) {
        closeClassModal();
    }
});

// ===============================
//  MODAL DE AJUDA (BOTÃO ?)
// ===============================

helpButton.addEventListener("click", () => {
    helpModalBackdrop.classList.add("show");
});

helpModalClose.addEventListener("click", () => {
    helpModalBackdrop.classList.remove("show");
});

helpModalBackdrop.addEventListener("click", (e) => {
    if (e.target === helpModalBackdrop) {
        helpModalBackdrop.classList.remove("show");
    }
});

// ===============================
//  INICIAR
// ===============================

carregarConfig();
