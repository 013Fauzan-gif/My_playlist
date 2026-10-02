const DB_NAME = "piringan-mp3-v1";
const STORE = "tracks";
const VOLUME_KEY = "piringan-mp3-volume";
const LABELS = ["#e85a8c", "#c44772", "#d98bb0", "#a33d68", "#f08aaf", "#b44e86"];

const stage = document.getElementById("stage");
const label = document.getElementById("label");
const labelMark = document.getElementById("label-mark");
const nowArtist = document.getElementById("now-artist");
const nowTitle = document.getElementById("now-title");
const seek = document.getElementById("seek");
const currentTimeEl = document.getElementById("current-time");
const durationEl = document.getElementById("duration");
const prevBtn = document.getElementById("prev-btn");
const toggleBtn = document.getElementById("toggle-btn");
const nextBtn = document.getElementById("next-btn");
const volume = document.getElementById("volume");
const addBtn = document.getElementById("add-btn");
const fileInput = document.getElementById("file-input");
const message = document.getElementById("message");
const playlist = document.getElementById("playlist");
const audio = document.getElementById("audio");

let tracks = [];
let currentId = null;
let objectUrl = null;
let seeking = false;

document.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem(VOLUME_KEY);
    const savedVolume = Number(saved);
    if (saved !== null && Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
        volume.value = String(savedVolume);
    }
    audio.volume = Number(volume.value);
    loadTracks().then(render).catch(() => {
        setMessage("Playlist tidak bisa dibuka di browser ini.");
    });
});

addBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
    addFiles([...fileInput.files]);
    fileInput.value = "";
});

document.addEventListener("dragover", (event) => {
    event.preventDefault();
    document.body.classList.add("is-dragover");
});

document.addEventListener("dragleave", (event) => {
    if (!event.relatedTarget) document.body.classList.remove("is-dragover");
});

document.addEventListener("drop", (event) => {
    event.preventDefault();
    document.body.classList.remove("is-dragover");
    addFiles([...event.dataTransfer.files]);
});

prevBtn.addEventListener("click", () => step(-1));
nextBtn.addEventListener("click", () => step(1));
toggleBtn.addEventListener("click", toggle);

volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    localStorage.setItem(VOLUME_KEY, volume.value);
});

seek.addEventListener("pointerdown", () => {
    seeking = true;
});
seek.addEventListener("pointerup", () => {
    seeking = false;
});
seek.addEventListener("input", () => {
    if (!audio.duration) return;
    audio.currentTime = Number(seek.value);
    currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener("timeupdate", () => {
    if (seeking || !audio.duration) return;
    seek.value = String(audio.currentTime);
    currentTimeEl.textContent = formatTime(audio.currentTime);
});

audio.addEventListener("loadedmetadata", () => {
    seek.disabled = false;
    seek.max = String(audio.duration);
    durationEl.textContent = formatTime(audio.duration);
});

audio.addEventListener("play", () => {
    stage.classList.add("is-playing");
    toggleBtn.textContent = "Jeda";
});

audio.addEventListener("pause", () => {
    stage.classList.remove("is-playing");
    toggleBtn.textContent = "Putar";
});

audio.addEventListener("ended", () => {
    const next = neighbor(1);
    if (next) play(next.id);
    else stopVisual();
});

audio.addEventListener("error", () => {
    setMessage("File ini tidak bisa diputar di browser.");
    stopVisual();
});

async function addFiles(files) {
    const audioFiles = files.filter(isAudio);
    if (audioFiles.length === 0) {
        setMessage("Pilih file audio, misalnya mp3.");
        return;
    }

    for (const file of audioFiles) {
        const names = parseName(file.name);
        const track = {
            id: createId(),
            title: names.title,
            artist: names.artist,
            blob: file,
            addedAt: Date.now()
        };
        await saveTrack(track);
        tracks.push(track);
    }

    setMessage("");
    render();
}

async function removeTrack(id) {
    await deleteTrack(id);
    const wasCurrent = currentId === id;
    tracks = tracks.filter((track) => track.id !== id);
    if (wasCurrent) {
        audio.pause();
        clearAudio();
        currentId = null;
        resetNow();
    }
    setMessage("");
    render();
}

function toggle() {
    if (!currentId) {
        if (tracks.length === 0) {
            setMessage("Tambahkan lagu dulu.");
            return;
        }
        play(tracks[0].id);
        return;
    }

    if (audio.paused) audio.play().catch(() => setMessage("Browser menolak memutar audio."));
    else audio.pause();
}

function step(direction) {
    if (tracks.length === 0) return;
    const target = neighbor(direction) || tracks[direction > 0 ? 0 : tracks.length - 1];
    play(target.id);
}

function play(id) {
    const track = tracks.find((item) => item.id === id);
    if (!track) return;

    if (currentId !== id) {
        clearAudio();
        objectUrl = URL.createObjectURL(track.blob);
        audio.src = objectUrl;
        currentId = id;
        seek.value = "0";
        seek.max = "0";
        currentTimeEl.textContent = "0:00";
        durationEl.textContent = "0:00";
    }

    nowArtist.textContent = track.artist;
    nowTitle.textContent = track.title;
    label.style.background = labelColor(track.title);
    labelMark.textContent = mark(track.title);
    setMessage("");
    renderPlaylist();
    audio.play().catch(() => setMessage("Browser menolak memutar audio."));
}

function neighbor(direction) {
    const index = tracks.findIndex((track) => track.id === currentId);
    if (index === -1) return null;
    return tracks[index + direction] || null;
}

function render() {
    renderPlaylist();
    updateTransport();
    if (!currentId) resetNow();
}

function renderPlaylist() {
    playlist.replaceChildren();
    if (tracks.length === 0) {
        playlist.append(note("Belum ada lagu. Tambahkan file mp3 dari komputermu."));
        return;
    }

    tracks.forEach((track, index) => {
        const item = document.createElement("li");
        item.className = "track";
        if (track.id === currentId) item.classList.add("is-active");

        const playButton = document.createElement("button");
        playButton.type = "button";
        playButton.className = "track-play";

        const number = document.createElement("span");
        number.className = "track-index";
        number.textContent = String(index + 1);

        const text = document.createElement("span");
        const title = document.createElement("span");
        title.className = "track-title";
        title.textContent = track.title;
        const artist = document.createElement("span");
        artist.className = "track-artist";
        artist.textContent = track.artist;
        text.append(title, artist);
        playButton.append(number, text);
        playButton.addEventListener("click", () => play(track.id));

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "icon-btn";
        remove.setAttribute("aria-label", `Hapus ${track.title}`);
        remove.textContent = "×";
        remove.addEventListener("click", () => removeTrack(track.id));

        item.append(playButton, remove);
        playlist.append(item);
    });
}

function updateTransport() {
    const empty = tracks.length === 0;
    prevBtn.disabled = empty;
    nextBtn.disabled = empty;
}

function resetNow() {
    nowArtist.textContent = "Siap diputar";
    nowTitle.textContent = tracks.length === 0 ? "Belum ada lagu" : "Pilih sebuah lagu";
    label.style.background = "#e85a8c";
    labelMark.textContent = "♪";
    seek.disabled = true;
    seek.value = "0";
    seek.max = "0";
    currentTimeEl.textContent = "0:00";
    durationEl.textContent = "0:00";
    stage.classList.remove("is-playing");
    toggleBtn.textContent = "Putar";
}

function stopVisual() {
    stage.classList.remove("is-playing");
    toggleBtn.textContent = "Putar";
}

function clearAudio() {
    audio.removeAttribute("src");
    audio.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
}

function isAudio(file) {
    return file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name);
}

function parseName(filename) {
    const base = filename.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
    const parts = base.split(/\s+-\s+/);
    if (parts.length >= 2) {
        return { artist: parts[0], title: parts.slice(1).join(" - ") };
    }
    return { artist: "Koleksi sendiri", title: base || "Tanpa judul" };
}

function mark(title) {
    const letter = title.trim().charAt(0);
    return letter ? letter.toUpperCase() : "♪";
}

function labelColor(title) {
    const total = [...title].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return LABELS[total % LABELS.length];
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(whole / 60);
    const remain = whole % 60;
    return `${minutes}:${String(remain).padStart(2, "0")}`;
}

function setMessage(text) {
    message.textContent = text;
}

function note(text) {
    const item = document.createElement("li");
    item.className = "empty";
    item.textContent = text;
    return item;
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadTracks() {
    const db = await openDb();
    const records = await requestToPromise(db.transaction(STORE, "readonly").objectStore(STORE).getAll());
    db.close();
    tracks = records.sort((a, b) => a.addedAt - b.addedAt);
}

async function saveTrack(track) {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(track);
    await transactionDone(tx);
    db.close();
}

async function deleteTrack(id) {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    await transactionDone(tx);
    db.close();
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}
