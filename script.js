const micButton = document.getElementById('mic-button');
let isRecording = false;
let mediaRecorder;
let audioChunks = [];
let replyingTo = null;

let stream;

// 🔥 CLICK (mobile + desktop) PARA RESPONDER
let lastTap = 0;

document.querySelector('main').addEventListener('click', (e) => {
    const msgEl = e.target.closest('.msg');
    if (!msgEl) return;

    const now = new Date().getTime();

    // double tap (mobile + desktop)
    if (now - lastTap < 300) {
        replyingTo = msgEl.dataset.text || null;

        if (replyingTo) {
            msg_field.placeholder = `Respondendo: "${replyingTo.slice(0, 30)}..."`;
        }
    }

    lastTap = now;
});

micButton.addEventListener('click', async () => {
    try {
        if (!isRecording) {

            stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                try {

                    if (!audioChunks.length) return;

                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

                    const childBlob = await criarAudioVozCrianca(audioBlob);

                    const reader = new FileReader();

                    reader.onload = () => {
                        const base64Audio = reader.result;

                        criarMensagemAudio(base64Audio, true, replyingTo);

                        const msg = {
                            audio: base64Audio,
                            type: 'audio',
                            chat_id,
                            reply: replyingTo
                        };

                        socket.emit('send_message', msg);

                        stream.getTracks().forEach(track => track.stop());

                        replyingTo = null;
                        msg_field.placeholder = "Mensagem";
                    };

                    reader.readAsDataURL(childBlob);

                } catch (err) {
                    console.error("ERRO ONSTOP:", err);
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

function gerarWaveform() {
    let bars = "";
    for (let i = 0; i < 20; i++) {
        const height = Math.floor(Math.random() * 20) + 5;
        bars += `<div class="waveform-bar" style="height:${height}px"></div>`;
    }
    return bars;
}


// CRIA VOZ CRIANÇA
async function criarAudioVozCrianca(audioBlob) {
    const audioCtx = new AudioContext();
    await audioCtx.resume();

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    source.playbackRate.value = 1.35;

    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);

    const recorder = new MediaRecorder(dest.stream, {
        mimeType: "audio/webm"
    });

    let chunks = [];

    recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
            chunks.push(e.data);
        }
    };

    const finalBlob = await new Promise((resolve, reject) => {
        recorder.onstop = () => {
            try {
                resolve(new Blob(chunks, { type: "audio/webm" }));
            } catch (err) {
                reject(err);
            }
        };

        recorder.onerror = (err) => reject(err);

        recorder.start(100);
        source.start(0);

        source.onended = () => recorder.stop();
    });

    await audioCtx.close();

    return finalBlob;
}


// 🔥 AUDIO MESSAGE (COM REPLY FIX)
function criarMensagemAudio(audioUrl, isMe = true, reply = null) {

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
                 now.getMinutes().toString().padStart(2, '0');

    const id = "audio_" + Date.now();

    const containerAlign = isMe ? "items-end self-end" : "items-start";
    const bubbleColor = isMe ? "bg-[#5865F2] text-white" : "bg-surface-container-high text-white";
    const borderRadius = isMe ? "rounded-tr-none" : "rounded-tl-none";
    const timeAlign = isMe ? "mr-1" : "ml-1";

    const replyHtml = reply
        ? `
        <div class="bg-black/20 border-l-4 rounded p-2 mb-2">
            <p class="text-[11px] text-zinc-400 truncate">${reply}</p>
        </div>
        `
        : "";

    const html = `
    <div class="flex flex-col gap-1 max-w-[85%] ${containerAlign} message-entrance shrink-0 msg"
         data-text="${reply || 'áudio'}">

        <div class="${bubbleColor} px-4 py-3 rounded-2xl ${borderRadius} flex flex-col gap-2 w-64 max-w-full shadow-lg">

            ${replyHtml}

            <div class="flex items-center gap-3">

                <button onclick="toggleAudio('${id}', this)" 
                    class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform shrink-0">
                    <span class="material-symbols-outlined">play_arrow</span>
                </button>

                <audio id="${id}" src="${audioUrl}"></audio>

                <div class="flex-1 flex items-end gap-[2px] h-6 overflow-hidden" id="wave_${id}">
                    ${gerarWaveform()}
                </div>

                <span class="text-[10px] font-medium opacity-80 shrink-0" id="time_${id}">
                    0:00
                </span>

            </div>
        </div>

        <div class="flex items-center gap-1 ${timeAlign}">
            <span class="text-[10px] text-zinc-500">${time}</span>
        </div>

    </div>
    `;

    chatMain.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
}


// 🔥 TEXT MESSAGE (COM REPLY FIX)
function criarMensagemTexto({ texto, isMe = true, reply = null }) {

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
                 now.getMinutes().toString().padStart(2, '0');

    const containerClass = isMe ? "items-end self-end" : "items-start";

    const bubbleClass = isMe
        ? "bg-[#5865F2] text-white border border-white/10 rounded-tr-none"
        : "bg-surface-container-high text-on-surface border border-white/5 rounded-tl-none";

    const checkIcon = isMe
        ? `<span class="material-symbols-outlined text-[12px] text-secondary" style="font-variation-settings: 'FILL' 1;">done_all</span>`
        : "";

    const timeClass = isMe ? "mr-1" : "ml-1";

    const replyHtml = reply
        ? `
        <div class="bg-black/20 border-l-4 rounded p-2 mb-2">
            <p class="text-[11px] text-zinc-400 truncate">${reply}</p>
        </div>
        `
        : "";

    const html = `
    <div class="flex flex-col gap-1 max-w-[85%] message-entrance shrink-0 ${containerClass} msg"
         data-text="${texto}">
        
        <div class="p-3 rounded-2xl shadow-lg ${bubbleClass}">
            
            ${replyHtml}
            
            <p class="leading-relaxed">${texto}</p>
        </div>

        <div class="flex items-center gap-1 ${timeClass}">
            <span class="text-[10px] text-zinc-500">${time}</span>
            ${checkIcon}
        </div>

    </div>
    `;

    chatMain.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
}