const micButton = document.getElementById('mic-button');

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let stream = null;

// ============================
// 🎤 INICIAR / PARAR GRAVAÇÃO
// ============================
micButton.addEventListener('click', async () => {
    try {
        if (!isRecording) {

            stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm'
            });

            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                try {

                    if (!audioChunks.length) return;

                    const audioBlob = new Blob(audioChunks, {
                        type: 'audio/webm'
                    });

                    const childBlob = await criarAudioVozCrianca(audioBlob);

                    const reader = new FileReader();

                    reader.onload = () => {
                        const base64Audio = reader.result;

                        criarMensagemAudio(base64Audio, true);

                        const msg = {
                            audio: base64Audio,
                            type: 'audio',
                            chat_id
                        };

                        socket.emit('send_message', msg);

                        // 🔥 parar microfone corretamente
                        if (stream) {
                            stream.getTracks().forEach(track => track.stop());
                        }
                    };

                    reader.readAsDataURL(childBlob);

                } catch (err) {
                    console.error("Erro ao processar áudio:", err);
                }
            };

            mediaRecorder.start();

            isRecording = true;
            micButton.classList.add('recording-active');

        } else {

            mediaRecorder.stop();

            isRecording = false;
            micButton.classList.remove('recording-active');
        }

    } catch (error) {
        console.error(error);
        alert("Não foi possível aceder ao microfone");
    }
});


// ============================
// 👶 EFEITO VOZ DE CRIANÇA
// ============================
async function criarAudioVozCrianca(audioBlob) {

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();

    if (audioCtx.state === "suspended") {
        await audioCtx.resume();
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    source.playbackRate.value = 1.35;

    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

    const recorder = new MediaRecorder(dest.stream, { mimeType });

    let chunks = [];

    recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
            chunks.push(e.data);
        }
    };

    const finalBlob = await new Promise((resolve, reject) => {

        recorder.onstop = () => {
            resolve(new Blob(chunks, { type: "audio/webm" }));
        };

        recorder.onerror = (e) => reject(e.error || e);

        recorder.start(100);

        // 🔥 seguro
        requestAnimationFrame(() => {
            source.start(0);
        });

        source.onended = () => recorder.stop();
    });

    await audioCtx.close();

    return finalBlob;
}


// ============================
// 🔊 MENSAGEM DE ÁUDIO
// ============================
function criarMensagemAudio(audioUrl, isMe = true) {

    const now = new Date();
    const time =
        now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');

    const id = "audio_" + Date.now();

    const containerAlign = isMe ? "items-end self-end" : "items-start";
    const bubbleColor = isMe
        ? "bg-[#5865F2] text-white"
        : "bg-surface-container-high text-white";

    const borderRadius = isMe ? "rounded-tr-none" : "rounded-tl-none";

    const html = `
    <div class="flex flex-col gap-1 max-w-[85%] ${containerAlign} message-entrance shrink-0">

        <div class="${bubbleColor} px-4 py-3 rounded-2xl ${borderRadius}
                    flex items-center gap-3 w-64 max-w-full shadow-lg">

            <button onclick="toggleAudio('${id}', this)"
                class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">

                <span class="material-symbols-outlined">play_arrow</span>
            </button>

            <audio id="${id}" src="${audioUrl}"></audio>

            <div class="flex-1 flex items-end gap-[2px] h-6 overflow-hidden">
                ${gerarWaveform()}
            </div>

            <span class="text-[10px] opacity-80" id="time_${id}">
                0:00
            </span>

        </div>

        <div class="text-[10px] text-zinc-500 ml-1">
            ${time}
        </div>

    </div>
    `;

    chatMain.insertAdjacentHTML('beforeend', html);
    scrollToBottom();

    const audio = document.getElementById(id);

    audio.onloadedmetadata = () => {
        document.getElementById(`time_${id}`).innerText =
            formatarTempo(audio.duration);
    };
}


// ============================
// 🎤 TEXTO
// ============================
function criarMensagemTexto({ texto, isMe = true, reply = null }) {

    const now = new Date();
    const time =
        now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0');

    const containerClass = isMe ? "items-end self-end" : "items-start";

    const bubbleClass = isMe
        ? "bg-[#5865F2] text-white"
        : "bg-surface-container-high text-white";

    const html = `
    <div class="flex flex-col gap-1 max-w-[85%] ${containerClass} message-entrance shrink-0">

        <div class="p-3 rounded-2xl ${bubbleClass}">
            <p>${texto}</p>
        </div>

        <div class="text-[10px] text-zinc-500">
            ${time}
        </div>

    </div>
    `;

    chatMain.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
}


// ============================
// 🌊 WAVES
// ============================
function gerarWaveform() {
    let bars = "";

    for (let i = 0; i < 20; i++) {
        const h = Math.floor(Math.random() * 20) + 5;
        bars += `<div class="waveform-bar" style="height:${h}px"></div>`;
    }

    return bars;
}


// ============================
// ⏱ TEMPO
// ============================
function formatarTempo(segundos) {
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60);

    return `${min}:${sec.toString().padStart(2, '0')}`;
}


// ============================
// ▶️ PLAY AUDIO
// ============================
function toggleAudio(id, btn) {

    const audio = document.getElementById(id);
    const icon = btn.querySelector('span');

    if (audio.paused) {
        audio.play();
        icon.innerText = "pause";
    } else {
        audio.pause();
        icon.innerText = "play_arrow";
    }

    audio.onended = () => {
        icon.innerText = "play_arrow";
    };
}