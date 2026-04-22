const micButton = document.getElementById('mic-button');
    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];

    micButton.addEventListener('click', async () => {
    try {
        if (!isRecording) {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });

            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                console.log("STOP gravado");

                if (!audioChunks.length) {
                    console.warn("Nenhum áudio gravado");
                    return;
                }

                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

                console.log("Processando voz de criança...");

                // 👶 transforma o áudio
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
                };

                reader.readAsDataURL(childBlob);
                socket.emit('send_message', msg);

                stream.getTracks().forEach(track => track.stop());
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

//CRIA VOZ CRIANÇA
async function criarAudioVozCrianca(audioBlob) {
    const audioCtx = new AudioContext();

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    // 👶 VOZ DE CRIANÇA (efeito real)
    source.playbackRate.value = 1.35; // mais rápido = mais “jovem”

    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);

    const recorder = new MediaRecorder(dest.stream, {
        mimeType: "audio/webm"
    });

    let chunks = [];

    recorder.ondataavailable = (e) => {
        chunks.push(e.data);
    };

    const finalBlob = await new Promise((resolve) => {
        recorder.onstop = () => {
            const newBlob = new Blob(chunks, { type: "audio/webm" });
            resolve(newBlob);
        };

        recorder.start();
        source.start();

        source.onended = () => {
            recorder.stop();
        };
    });

    return finalBlob;
}
function criarMensagemAudio(audioUrl, isMe = true) {

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
                 now.getMinutes().toString().padStart(2, '0');

    const id = "audio_" + Date.now();

    // classes dinâmicas (EU vs OUTRO)
    const containerAlign = isMe ? "items-end self-end" : "items-start";
    const bubbleColor = isMe ? "bg-[#5865F2] text-white" : "bg-surface-container-high text-white";
    const borderRadius = isMe ? "rounded-tr-none" : "rounded-tl-none";
    const timeAlign = isMe ? "mr-1" : "ml-1";

    const html = `
    <div class="flex flex-col gap-1 max-w-[85%] ${containerAlign} message-entrance shrink-0">

        <div class="${bubbleColor} px-4 py-3 rounded-2xl ${borderRadius} flex items-center gap-3 w-64 max-w-full shadow-lg">

            <button onclick="toggleAudio('${id}', this)" 
                class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform shrink-0">
                
                <span class="material-symbols-outlined">play_arrow</span>
            </button>

            <audio id="${id}" src="${audioUrl}"></audio>

            <!-- waveform -->
            <div class="flex-1 flex items-end gap-[2px] h-6 overflow-hidden" id="wave_${id}">
                ${gerarWaveform()}
            </div>

            <span class="text-[10px] font-medium opacity-80 shrink-0" id="time_${id}">
                0:00
            </span>

        </div>

        <div class="flex items-center gap-1 ${timeAlign}">
            <span class="text-[10px] text-zinc-500">${time}</span>
            ${isMe ? `<span class="material-symbols-outlined text-[12px] text-secondary" style="font-variation-settings: 'FILL' 1;">done_all</span>` : ``}
        </div>

    </div>
    `;

    chatMain.insertAdjacentHTML('beforeend', html);
    scrollToBottom();

    // calcular duração real
    const audio = document.getElementById(id);
    audio.onloadedmetadata = () => {
        const duration = formatarTempo(audio.duration);
        document.getElementById(`time_${id}`).innerText = duration;
    };
}
function criarMensagemTexto({ texto, isMe = true, reply = null }) {

    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ':' +
                 now.getMinutes().toString().padStart(2, '0');

    // lado (direita = eu, esquerda = outro)
    const containerClass = isMe
        ? "items-end self-end"
        : "items-start";

    // estilo da bolha
    const bubbleClass = isMe
        ? "bg-[#5865F2] text-white border border-white/10 rounded-tr-none"
        : "bg-surface-container-high text-on-surface border border-white/5 rounded-tl-none";

    // check azul (só eu)
    const checkIcon = isMe
        ? `<span class="material-symbols-outlined text-[12px] text-secondary" style="font-variation-settings: 'FILL' 1;">done_all</span>`
        : "";

    // margem do tempo
    const timeClass = isMe ? "mr-1" : "ml-1";

    // reply opcional
    const replyHtml = reply
        ? `
        <div class="${isMe ? 'bg-white/10 border-white/30' : 'bg-black/20 border-black/30'} border-l-4 rounded p-2 mb-2">
            <p class="text-[11px] ${isMe ? 'text-white/70' : 'text-zinc-400'} truncate">
                ${reply}
            </p>
        </div>
        `
        : "";

    const html = `
    <div class="flex flex-col gap-1 max-w-[85%] message-entrance shrink-0 ${containerClass}">
        
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
function gerarWaveform() {
    let bars = "";
    for (let i = 0; i < 20; i++) {
        const height = Math.floor(Math.random() * 20) + 5;
        bars += `<div class="waveform-bar" style="height:${height}px"></div>`;
    }
    return bars;
}

function formatarTempo(segundos) {
    const min = Math.floor(segundos / 60);
    const sec = Math.floor(segundos % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}


function toggleAudio(id, btn) {
    const audio = document.getElementById(id);
    const icon = btn.querySelector('span');
    const wave = document.getElementById(`wave_${id}`);

    if (audio.paused) {
        audio.play();
        icon.innerText = "pause";

        // animar ondas
        wave.classList.add("playing");

    } else {
        audio.pause();
        icon.innerText = "play_arrow";

        wave.classList.remove("playing");
    }

    audio.onended = () => {
        icon.innerText = "play_arrow";
        wave.classList.remove("playing");
    };
}