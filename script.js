const chatInput = document.querySelector('#chat-input');
const sendButton = document.querySelector('#send-btn');
const chatContainer = document.querySelector('.chat-container');
const themeButton = document.querySelector('#theme-btn');
const deleteButton = document.querySelector('#delete-btn');
// import DID_API from './api.json' assert { type: 'json' };
const DID_API = {
  key: 'bWlzdHlyaW91cy5hbmRyZWFAZ21haWwuY29t:8COcCWLT_xbXLr8prstqZ',
  url: 'https://api.d-id.com',
  key_eleven: '1fefa3efccc79b3c9189d099903455fd',
  url_eleven: 'https://api.elevenlabs.io/v1/text-to-speech',
  voice_id: 'KnYFC38VyV4KNvdv9Tq0',
  url_openai: 'http://localhost:3000/openai',
};

let userText = null;
const API_KEY = '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'; // Paste your API key here

let peerConnection;
let streamId;
let sessionId;
let sessionClientAnswer;

let statsIntervalId;
let videoIsPlaying;
let lastBytesReceived;
const talkVideo = document.getElementById('talk-video');

console.log('hello world');

const loadDataFromLocalstorage = async () => {
  // Load saved chats and theme from local storage and apply/add on the page
  const themeColor = localStorage.getItem('themeColor');

  document.body.classList.toggle('light-mode', themeColor === 'light_mode');
  themeButton.innerText = document.body.classList.contains('light-mode')
    ? 'dark_mode'
    : 'light_mode';

  const defaultText = `<div class="default-text">
                            <h1>Welcome to BrockGPT  Chatbot!</h1>
                            <p>This is a demo website which is not yet open to public. 
                            <br /> We are currently working on optimizing the product to <br />provide a more optimized product!</p>
                            <p>
                            <span style="font-weight: bold;">
                            For more information, please contact: 
                            </span>
                            <br />
                            brock@returnondata.co <br />darrel@returnondata.co
                            </p>
                            <p></p>
                        </div>`;

  chatContainer.innerHTML = localStorage.getItem('all-chats') || defaultText;
  chatContainer.scrollTo(0, chatContainer.scrollHeight); // Scroll to bottom of the chat container
  await connect();
};

const createChatElement = (content, className) => {
  // Create new div and apply chat, specified class and set html content of div
  const chatDiv = document.createElement('div');
  chatDiv.classList.add('chat', className);
  chatDiv.innerHTML = content;
  return chatDiv; // Return the created chat div
};

const getChatResponse = async (incomingChatDiv) => {
  const API_URL = 'https://api.openai.com/v1/completions';
  const pElement = document.createElement('p');

  // Define the properties and data for the API request
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-davinci-003',
      prompt: userText,
      max_tokens: 100,
      temperature: 0.2,
      n: 1,
      stop: null,
    }),
  };

  // Send POST request to API, get response and set the reponse as paragraph element text
  try {
    const response = await (await fetch(API_URL, requestOptions)).json();
    const responseData = response.choices[0].text.trim();
    pElement.textContent = response.choices[0].text.trim();

    const generateVoice = await fetch(
      `http://localhost:3000/api/eleven-studio`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: responseData,
        }),
      }
    );

    const generateVoiceResponse = await generateVoice.json();
    console.log(`11 Eleven Studio ${generateVoiceResponse}`);

    // Consume D-ID
    /** Upload Generated Audio */
    const uploadGeneratedAudio = await fetch(
      `http://localhost:3000/api/d-id/upload/audio`,
      {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    const uploadGeneratedAudioResponse = await uploadGeneratedAudio.json();
    console.log(
      `D-ID upload generated audio response ${JSON.stringify(
        uploadGeneratedAudioResponse
      )}`
    );

    /** Make Avatar talk */
    // connectionState not supported in firefox
    await createTalkStream(uploadGeneratedAudioResponse);
  } catch (error) {
    console.log(error);
    // Add error class to the paragraph element and set error text
    pElement.classList.add('error');
    pElement.textContent =
      'Oops! Something went wrong while retrieving the response. Please try again.';
  }

  // Remove the typing animation, append the paragraph element and save the chats to local storage
  incomingChatDiv.querySelector('.typing-animation').remove();
  incomingChatDiv.querySelector('.chat-details').appendChild(pElement);
  localStorage.setItem('all-chats', chatContainer.innerHTML);
  chatContainer.scrollTo(0, chatContainer.scrollHeight);
};

const copyResponse = (copyBtn) => {
  // Copy the text content of the response to the clipboard
  const reponseTextElement = copyBtn.parentElement.querySelector('p');
  navigator.clipboard.writeText(reponseTextElement.textContent);
  copyBtn.textContent = 'done';
  setTimeout(() => (copyBtn.textContent = 'content_copy'), 1000);
};

const showTypingAnimation = () => {
  // Display the typing animation and call the getChatResponse function
  const html = `<div class="chat-content">
                    <div class="chat-details">
                        <img src="images/chatbot.jpg" alt="chatbot-img">
                        <div class="typing-animation">
                            <div class="typing-dot" style="--delay: 0.2s"></div>
                            <div class="typing-dot" style="--delay: 0.3s"></div>
                            <div class="typing-dot" style="--delay: 0.4s"></div>
                        </div>
                    </div>
                    <span onclick="copyResponse(this)" class="material-symbols-rounded">content_copy</span>
                </div>`;
  // Create an incoming chat div with typing animation and append it to chat container
  const incomingChatDiv = createChatElement(html, 'incoming');
  chatContainer.appendChild(incomingChatDiv);
  chatContainer.scrollTo(0, chatContainer.scrollHeight);
  getChatResponse(incomingChatDiv);
};

const handleOutgoingChat = () => {
  userText = chatInput.value.trim(); // Get chatInput value and remove extra spaces
  if (!userText) return; // If chatInput is empty return from here

  // Clear the input field and reset its height
  chatInput.value = '';
  chatInput.style.height = `${initialInputHeight}px`;

  const html = `<div class="chat-content">
                    <div class="chat-details">
                        <img src="images/user.jpg" alt="user-img">
                        <p>${userText}</p>
                    </div>
                </div>`;

  // Create an outgoing chat div with user's message and append it to chat container
  const outgoingChatDiv = createChatElement(html, 'outgoing');
  chatContainer.querySelector('.default-text')?.remove();
  chatContainer.appendChild(outgoingChatDiv);
  chatContainer.scrollTo(0, chatContainer.scrollHeight);
  setTimeout(showTypingAnimation, 500);
};

deleteButton.addEventListener('click', () => {
  // Remove the chats from local storage and call loadDataFromLocalstorage function
  if (confirm('Are you sure you want to delete all the chats?')) {
    localStorage.removeItem('all-chats');
    loadDataFromLocalstorage();
  }
});

themeButton.addEventListener('click', () => {
  // Toggle body's class for the theme mode and save the updated theme to the local storage
  document.body.classList.toggle('light-mode');
  localStorage.setItem('themeColor', themeButton.innerText);
  themeButton.innerText = document.body.classList.contains('light-mode')
    ? 'dark_mode'
    : 'light_mode';
});

const initialInputHeight = chatInput.scrollHeight;

chatInput.addEventListener('input', () => {
  // Adjust the height of the input field dynamically based on its content
  chatInput.style.height = `${initialInputHeight}px`;
  chatInput.style.height = `${chatInput.scrollHeight}px`;
});

chatInput.addEventListener('keydown', (e) => {
  // If the Enter key is pressed without Shift and the window width is larger
  // than 800 pixels, handle the outgoing chat
  if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 800) {
    e.preventDefault();
    handleOutgoingChat();
    talkVideo.removeAttribute('muted');
  }
});

loadDataFromLocalstorage();
sendButton.addEventListener('click', handleOutgoingChat);

if (DID_API.key == '🤫')
  alert('Please put your api key inside ./api.json and restart..');

const RTCPeerConnection = (
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection
).bind(window);

talkVideo.setAttribute('playsinline', '');

function onIceCandidate(event) {
  console.log('onIceCandidate', event);
  if (event.candidate) {
    const { candidate, sdpMid, sdpMLineIndex } = event.candidate;

    fetch(`${DID_API.url}/talks/streams/${streamId}/ice`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate,
        sdpMid,
        sdpMLineIndex,
        session_id: sessionId,
      }),
    });
  }
}
function onIceConnectionStateChange() {
  if (
    peerConnection.iceConnectionState === 'failed' ||
    peerConnection.iceConnectionState === 'closed'
  ) {
    stopAllStreams();
    closePC();
  }
}

function onVideoStatusChange(videoIsPlaying, stream) {
  let status;
  if (videoIsPlaying) {
    status = 'streaming';
    const remoteStream = stream;
    setVideoElement(remoteStream);
  } else {
    status = 'empty';
    playIdleVideo();
  }
}

function onTrack(event) {
  /**
   * The following code is designed to provide information about wether currently there is data
   * that's being streamed - It does so by periodically looking for changes in total stream data size
   *
   * This information in our case is used in order to show idle video while no talk is streaming.
   */

  if (!event.track) return;

  statsIntervalId = setInterval(async () => {
    const stats = await peerConnection.getStats(event.track);
    stats.forEach((report) => {
      if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
        const videoStatusChanged =
          videoIsPlaying !== report.bytesReceived > lastBytesReceived;

        if (videoStatusChanged) {
          videoIsPlaying = report.bytesReceived > lastBytesReceived;
          onVideoStatusChange(videoIsPlaying, event.streams[0]);
        }
        lastBytesReceived = report.bytesReceived;
      }
    });
  }, 500);
}

async function createPeerConnection(offer, iceServers) {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection({ iceServers });

    peerConnection.addEventListener('icecandidate', onIceCandidate, true);
    peerConnection.addEventListener(
      'iceconnectionstatechange',
      onIceConnectionStateChange,
      true
    );

    peerConnection.addEventListener('track', onTrack, true);
  }

  await peerConnection.setRemoteDescription(offer);
  console.log('set remote sdp OK');

  const sessionClientAnswer = await peerConnection.createAnswer();
  console.log('create local sdp OK');

  await peerConnection.setLocalDescription(sessionClientAnswer);
  console.log('set local sdp OK');

  return sessionClientAnswer;
}

function setVideoElement(stream) {
  if (!stream) return;
  talkVideo.srcObject = stream;
  talkVideo.loop = false;

  // safari hotfix
  if (talkVideo.paused) {
    talkVideo
      .play()
      .then((_) => {})
      .catch((e) => {});
  }
}

function playIdleVideo() {
  talkVideo.srcObject = undefined;
  talkVideo.src = './assets/idle2.mp4';
  talkVideo.loop = true;
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    console.log('stopping video streams');
    talkVideo.srcObject.getTracks().forEach((track) => track.stop());
    talkVideo.srcObject = null;
  }
}

function closePC(pc = peerConnection) {
  if (!pc) return;
  console.log('stopping peer connection');
  pc.close();

  pc.removeEventListener('icecandidate', onIceCandidate, true);
  pc.removeEventListener(
    'iceconnectionstatechange',
    onIceConnectionStateChange,
    true
  );

  pc.removeEventListener('track', onTrack, true);
  clearInterval(statsIntervalId);

  console.log('stopped peer connection');
  if (pc === peerConnection) {
    peerConnection = null;
  }
}

const maxRetryCount = 3;
const maxDelaySec = 4;

async function fetchWithRetries(url, options, retries = 1) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries <= maxRetryCount) {
      const delay =
        Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) * 1000;

      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(
        `Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`
      );
      return fetchWithRetries(url, options, retries + 1);
    } else {
      throw new Error(`Max retries exceeded. error: ${err}`);
    }
  }
}

const promptBtn = document.querySelector('#prompt-btn');
const promptText = document.querySelector('#prompt-text');
const promptResult = document.querySelector('#result');

// promptBtn.addEventListener('click', async () => {
//   let p = document.createElement('p');
//   let textNode = document.createTextNode(promptText.value);
//   let promptTextValue = promptText.value;
//   p.appendChild(textNode);
//   promptResult.appendChild(p);
//   promptText.value = '';

//   // Consume OpenAI API
//   const data = await fetch(`${DID_API.url_openai}`, {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify({
//       question: promptTextValue,
//     }),
//   });

//   const response = await data.json();
//   console.log(
//     `Request Body: ${JSON.stringify({
//       question: promptTextValue,
//     })}`
//   );

//   console.log('OpenAI API Data: ' + responseData);

//   // Consume Eleven API
// //   const generateVoice = await fetch(`http://localhost:3000/api/eleven-studio`, {
// //     method: 'POST',
// //     headers: {
// //       'Content-Type': 'application/json',
// //     },
// //     body: JSON.stringify({
// //       text: responseData,
// //     }),
// //   });

// //   const generateVoiceResponse = await generateVoice.json();
// //   console.log(`11 Eleven Studio ${generateVoiceResponse}`);

// //   // Consume D-ID
// //   /** Upload Generated Audio */
// //   const uploadGeneratedAudio = await fetch(
// //     `http://localhost:3000/api/d-id/upload/audio`,
// //     {
// //       method: 'POST',
// //       headers: {
// //         accept: 'application/json',
// //         'Content-Type': 'application/json',
// //       },
// //     }
// //   );

// //   const uploadGeneratedAudioResponse = await uploadGeneratedAudio.json();
// //   console.log(
// //     `D-ID upload generated audio response ${JSON.stringify(
// //       uploadGeneratedAudioResponse
// //     )}`
// //   );

// //   /** Make Avatar talk */
// //   // connectionState not supported in firefox
// //   await createTalkStream(uploadGeneratedAudioResponse);

//   let pr = document.createElement('p');
//   const textNodePR = document.createTextNode(responseData);
//   console.log('Response Open AI: ' + responseData);
//   pr.appendChild(textNodePR);
//   promptResult.appendChild(pr);
// });

async function processAudioQuery(promptTextValue) {
  //   let p = document.createElement('p');
  //   let textNode = document.createTextNode(promptTextValue);
  //   p.appendChild(textNode);
  //   promptResult.appendChild(p);

  // Consume OpenAI API
  const data = await fetch(`${DID_API.url_openai}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: promptTextValue,
    }),
  });

  const response = await data.json();
  console.log(
    `Request Body: ${JSON.stringify({
      question: promptTextValue,
    })}`
  );

  console.log('OpenAI API Data: ' + responseData);

  // Consume Eleven API
  const generateVoice = await fetch(`http://localhost:3000/api/eleven-studio`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: responseData,
    }),
  });

  const generateVoiceResponse = await generateVoice.json();
  console.log(`11 Eleven Studio ${generateVoiceResponse}`);

  // Consume D-ID
  /** Upload Generated Audio */
  const uploadGeneratedAudio = await fetch(
    `http://localhost:3000/api/d-id/upload/audio`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }
  );

  const uploadGeneratedAudioResponse = await uploadGeneratedAudio.json();
  console.log(
    `D-ID upload generated audio response ${JSON.stringify(
      uploadGeneratedAudioResponse
    )}`
  );

  /** Make Avatar talk */
  // connectionState not supported in firefox
  await createTalkStream(uploadGeneratedAudioResponse);

  //   let pr = document.createElement('p');
  //   const textNodePR = document.createTextNode(responseData);
  //   console.log('Response Open AI: ' + responseData);
  //   pr.appendChild(textNodePR);
  //   promptResult.appendChild(pr);
}

async function createTalkStream(uploadGeneratedAudioResponse) {
  if (
    peerConnection?.signalingState === 'stable' ||
    peerConnection?.iceConnectionState === 'connected'
  ) {
    const talkResponse = await fetchWithRetries(
      `${DID_API.url}/talks/streams/${streamId}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          script: {
            type: 'audio',
            audio_url: uploadGeneratedAudioResponse.url,
          },
          driver_url: 'bank://lively/',
          config: {
            stitch: true,
          },
          session_id: sessionId,
        }),
      }
    );
  }
}

// Connect while loading
async function connect() {
  if (peerConnection && peerConnection.connectionState === 'connected') {
    return;
  }

  stopAllStreams();
  closePC();

  //Brock
  const sessionResponse = await fetchWithRetries(
    `${DID_API.url}/talks/streams`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_url:
          'https://create-images-results.d-id.com/google-oauth2|103553419891215649397/upl_UtKL3R5j7L6cCFkFZRqgV/image.jpeg',
      }),
    }
  );

  const {
    id: newStreamId,
    offer,
    ice_servers: iceServers,
    session_id: newSessionId,
  } = await sessionResponse.json();
  streamId = newStreamId;
  sessionId = newSessionId;

  try {
    sessionClientAnswer = await createPeerConnection(offer, iceServers);
  } catch (e) {
    console.log('error during streaming setup', e);
    stopAllStreams();
    closePC();
    return;
  }

  const sdpResponse = await fetch(
    `${DID_API.url}/talks/streams/${streamId}/sdp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answer: sessionClientAnswer,
        session_id: sessionId,
      }),
    }
  );

  if (annyang) {
    // Let's define our first command. First the text we expect, and then the function it should call
    var commands = {
      'hi GPT *tag': async function (tag) {
        console.log('Send question to openAI: ', tag);
        await processAudioQuery(tag);
      },
      Hello: async function () {
        console.log('hello');
      },
    };

    // Add our commands to annyang
    annyang.addCommands(commands);

    // Start listening. You can call this here, or attach this call to an event, button, etc.
    annyang.start();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('hello world -2');
  talkVideo.muted = true;
});
