// script.js
// Front-end Vozes da Pirâmide (versão split em arquivo)

document.addEventListener("DOMContentLoaded", () => {
    // =========================
    // CONSTANTES
    // =========================
    const STATUS_JSON_URL =
        "https://raw.githubusercontent.com/GuhCansado/NOSENSE/main/server_status.json";

    // =========================
    // ELEMENTOS DOM
    // =========================
    const statusDot = document.getElementById("status-dot");
    const statusText = document.getElementById("status-text");
    const versionText = document.getElementById("version-text");
    const errorGlobal = document.getElementById("error-global");

    const postTextEl = document.getElementById("post-text");
    const btnPost = document.getElementById("btn-post");
    const feedEl = document.getElementById("feed");
    const feedEmptyEl = document.getElementById("feed-empty");

    const modalBackdrop = document.getElementById("class-modal-backdrop");
    const modalCloseBtn = document.getElementById("modal-close");

    // Pirâmide pode ser SVG (#pyramid-svg) ou DIV (.pyramid) – suportamos os dois
    const pyramidSvg = document.getElementById("pyramid-svg");
    const pyramidDiv = document.getElementById("pyramid");

    // Estado
    let API_BASE = null;
    let API_STATUS = "offline";
    let API_VERSION = "--";

    let stagedText = "";
    let modalOnSelect = null;

    // =========================
    // FUNÇÕES DE STATUS
    // =========================

    function setStatus(online, version) {
        API_STATUS = online ? "online" : "offline";

        statusDot.classList.remove("online", "offline");
        statusDot.classList.add(online ? "online" : "offline");

        statusText.textContent = online ? "Servidor Online" : "Servidor Offline";
        versionText.textContent = "API: " + (version || "--");

        btnPost.disabled = !online;
    }

    async function carregarConfig() {
        try {
            const resp = await fetch(
                STATUS_JSON_URL + "?cache=" + Date.now(),
                { cache: "no-store" }
            );

            if (!resp.ok) {
                throw new Error("Falha ao carregar server_status.json");
            }

            const data = await resp.json();

            API_BASE = data.url_api_base;
            API_VERSION = data.version_api || data.version_api || data.version_api === "" ? data.version_api : data.version_api;
            // fallback simples se a chave vier como version_api ou version_api (server antigo)
            if (!API_VERSION && data.version_api) API_VERSION = data.version_api;
            if (!API_VERSION && data.version) API_VERSION = data.version;

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
            errorGlobal.textContent =
                "Erro ao ler o server_status.json do GitHub. Verifique se o servidor foi iniciado.";
            setStatus(false, "--");
        }
    }

    // =========================
    // FEED / POSTS
    // =========================

    async function carregarFeed() {
        if (!API_BASE) return;
        try {
            const resp = await fetch(API_BASE + "/api/posts", {
                method: "GET",
                headers: { "Content-Type": "application/json" }
            });
            if (!resp.ok) throw new Error("Erro ao buscar posts");
            const posts = await resp.json();
            renderFeed(posts);
        } catch (err) {
            console.error(err);
            errorGlobal.style.display = "block";
            errorGlobal.textContent = "Erro ao carregar o feed. Verifique se o túnel ainda está ativo.";
        }
    }

    function escapeHtml(text) {
        if (!text) return "";
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    function renderFeed(posts) {
        feedEl.innerHTML = "";

        if (!posts || posts.length === 0) {
            feedEmptyEl.style.display = "block";
            return;
        }

        feedEmptyEl.style.display = "none";

        for (const post of posts) {
            const postDiv = document.createElement("div");
            postDiv.className = "post";
            postDiv.dataset.postId = post.id;

            const avatarBg = (post.avatar && post.avatar.bg_color) || "#4b5563";
            const emoji = (post.avatar && post.avatar.emoji) || "🙂";

            const created = post.created_at
                ? new Date(post.created_at).toLocaleString("pt-BR")
                : "";

            postDiv.innerHTML = `
                <div class="post-header">
                    <div class="avatar" style="background:${avatarBg};">
                        ${emoji}
                    </div>
                    <div class="post-meta">
                        <div class="alias">${post.alias || "Anônimo"}</div>
                        <div class="meta-line">
                            <span>${post.classe_label || ""}</span>
                            <span>•</span>
                            <span>${created}</span>
                            <span>•</span>
                            <span>${post.replies_count || 0} respostas</span>
                        </div>
                    </div>
                </div>
                <div class="post-text">${escapeHtml(post.texto || "")}</div>
                <div class="reply-box">
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:4px;">
                        Responder anonimamente
                    </div>
                    <textarea class="reply-textarea" rows="2" placeholder="Escreva sua resposta..."></textarea>
                    <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="small-btn primary btn-reply">Responder</button>
                        <button class="small-btn secondary btn-toggle-replies">Ver respostas</button>
                    </div>
                    <div class="error-msg reply-error" style="display:none;"></div>
                    <div class="replies" style="display:none;"></div>
                </div>
            `;

            // Botão responder
            const btnReply = postDiv.querySelector(".btn-reply");
            const replyTextarea = postDiv.querySelector(".reply-textarea");
            const replyError = postDiv.querySelector(".reply-error");

            btnReply.addEventListener("click", () => {
                const text = replyTextarea.value.trim();
                if (!text) {
                    replyError.style.display = "block";
                    replyError.textContent = "Digite alguma coisa para responder.";
                    return;
                }
                replyError.style.display = "none";
                stagedText = text;

                openClassModal(async (classe) => {
                    await enviarReply(
                        post.id,
                        stagedText,
                        classe,
                        replyError,
                        replyTextarea,
                        postDiv
                    );
                });
            });

            // Botão ver respostas
            const btnToggleReplies = postDiv.querySelector(".btn-toggle-replies");
            const repliesDiv = postDiv.querySelector(".replies");

            btnToggleReplies.addEventListener("click", async () => {
                if (repliesDiv.style.display === "none") {
                    await carregarReplies(postDiv, post.id);
                    repliesDiv.style.display = "block";
                    btnToggleReplies.textContent = "Esconder respostas";
                } else {
                    repliesDiv.style.display = "none";
                    btnToggleReplies.textContent = "Ver respostas";
                }
            });

            feedEl.appendChild(postDiv);
        }
    }

    async function carregarReplies(postDiv, postId) {
        const repliesDiv = postDiv.querySelector(".replies");
        repliesDiv.innerHTML = "";

        try {
            const resp = await fetch(
                API_BASE + "/api/posts/" + encodeURIComponent(postId) + "/replies",
                { method: "GET" }
            );
            if (!resp.ok) throw new Error("Erro ao buscar replies");
            const replies = await resp.json();

            if (!replies || replies.length === 0) {
                repliesDiv.innerHTML =
                    `<div class="empty-state" style="padding:4px 0;">Nenhuma resposta ainda.</div>`;
                return;
            }

            for (const r of replies) {
                const avatarBg = (r.avatar && r.avatar.bg_color) || "#4b5563";
                const emoji = (r.avatar && r.avatar.emoji) || "🙂";
                const created = r.created_at
                    ? new Date(r.created_at).toLocaleString("pt-BR")
                    : "";

                const replyEl = document.createElement("div");
                replyEl.className = "reply";
                replyEl.innerHTML = `
                    <div class="reply-header">
                        <div class="avatar" style="width:26px;height:26px;font-size:0.95rem;background:${avatarBg};">
                            ${emoji}
                        </div>
                        <div>
                            <div class="reply-alias">${r.alias || "Anônimo"}</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">
                                ${r.classe_label || ""} • ${created}
                            </div>
                        </div>
                    </div>
                    <div class="reply-text">${escapeHtml(r.texto || "")}</div>
                `;
                repliesDiv.appendChild(replyEl);
            }
        } catch (err) {
            repliesDiv.innerHTML =
                `<div class="error-msg">Erro ao carregar respostas.</div>`;
        }
    }

    async function enviarReply(
        postId,
        texto,
        classe,
        replyError,
        replyTextarea,
        postDiv
    ) {
        try {
            const resp = await fetch(
                API_BASE + "/api/posts/" + encodeURIComponent(postId) + "/replies",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ texto, classe })
                }
            );

            const data = await resp.json().catch(() => ({}));

            if (!resp.ok) {
                replyError.style.display = "block";
                replyError.textContent =
                    data.error || "Erro ao enviar resposta.";
            } else {
                replyTextarea.value = "";
                await carregarReplies(postDiv, postId);
                await carregarFeed();
            }
        } catch (err) {
            replyError.style.display = "block";
            replyError.textContent = "Erro de conexão ao enviar resposta.";
        }
    }

    // =========================
    // NOVO POST
    // =========================

    btnPost.addEventListener("click", () => {
        errorGlobal.style.display = "none";

        const texto = postTextEl.value.trim();
        if (!texto) {
            errorGlobal.style.display = "block";
            errorGlobal.textContent = "Escreva sua indignação antes de postar.";
            return;
        }

        if (!API_BASE || API_STATUS !== "online") {
            errorGlobal.style.display = "block";
            errorGlobal.textContent =
                "Servidor Offline. Inicie o servidor antes de postar.";
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto, classe })
            });

            const data = await resp.json().catch(() => ({}));

            if (!resp.ok) {
                errorGlobal.style.display = "block";
                errorGlobal.textContent =
                    data.error || "Erro ao criar postagem.";
            } else {
                postTextEl.value = "";
                await carregarFeed();
            }
        } catch (err) {
            console.error(err);
            errorGlobal.style.display = "block";
            errorGlobal.textContent = "Erro de conexão ao enviar postagem.";
        } finally {
            btnPost.disabled = false;
        }
    }

    // =========================
    // MODAL / PIRÂMIDE
    // =========================

    function openClassModal(onSelect) {
        modalOnSelect = onSelect;
        modalBackdrop.classList.add("show");

        clearPyramidSelection();

        // listener de clique nos layers
        const layerNodes = getPyramidLayers();
        layerNodes.forEach(layer => {
            layer.addEventListener("click", handlePyramidClick);
        });
    }

    function closeClassModal() {
        modalBackdrop.classList.remove("show");

        const layerNodes = getPyramidLayers();
        layerNodes.forEach(layer => {
            layer.removeEventListener("click", handlePyramidClick);
        });

        clearPyramidSelection();
        modalOnSelect = null;
    }

    function getPyramidLayers() {
        // Se existir SVG, usamos ele; se não, usamos divs .pyr-layer
        if (pyramidSvg) {
            return pyramidSvg.querySelectorAll("[data-classe]");
        }
        if (pyramidDiv) {
            return pyramidDiv.querySelectorAll("[data-classe]");
        }
        return [];
    }

    function clearPyramidSelection() {
        const layers = getPyramidLayers();
        layers.forEach(layer => layer.classList.remove("selected"));
    }

    function handlePyramidClick(e) {
        const target = e.target.closest("[data-classe]");
        if (!target) return;

        const classe = target.getAttribute("data-classe");
        if (!classe) return;

        // animação visual
        clearPyramidSelection();
        target.classList.add("selected");

        setTimeout(() => {
            closeClassModal();
            if (typeof modalOnSelect === "function") {
                modalOnSelect(classe);
            }
        }, 140);
    }

    modalCloseBtn.addEventListener("click", closeClassModal);

    modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) {
            closeClassModal();
        }
    });

    // =========================
    // START
    // =========================

    carregarConfig();
});
