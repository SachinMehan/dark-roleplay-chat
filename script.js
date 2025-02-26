
let conversationHistory = [];
let currentCharacterName = "Bot";
let userAvatar = "";
let charAvatar = "";


let messageDomList = [];

let isDeleteMode = false;

let selectedMessages = [];


let aiParams = {
  maxContext: 1000,
  maxLength: 500,
  temperature: 0.7,
  topP: 0.9,
  minP: 0.05,
  topK: 40,
  frequencyPenalty: 0,
  repetitionPenalty: 1.1
};


let mistralApiKeyGlobal = "";
let mistralModelGlobal  = "";
let openrouterApiKeyGlobal = "";
let openrouterModelGlobal  = "";


document.getElementById('settings-btn').addEventListener('click', function() {
  const initPanel = document.getElementById('roleplay-init');
  if (initPanel.style.display === "none" || initPanel.style.display === "") {
    initPanel.style.display = "flex";
  } else {
    initPanel.style.display = "none";
  }
});

document.getElementById('new-chat-btn').addEventListener('click', function() {
  conversationHistory = [];
  messageDomList = [];
  selectedMessages = [];
  document.getElementById('chat-window').innerHTML = "<div id='chat-background'></div>";
});


document.getElementById('delete-btn').addEventListener('click', function() {
  isDeleteMode = !isDeleteMode;
  selectedMessages = [];
  document.getElementById('delete-mode-footer').style.display = isDeleteMode ? 'flex' : 'none';
  if (!isDeleteMode) removeAllSelections();
});


document.getElementById('confirm-delete-btn').addEventListener('click', function() {
  if (selectedMessages.length === 0) {
    alert("No messages selected to delete.");
    return;
  }
  const earliest = Math.min(...selectedMessages);
  conversationHistory.splice(earliest, conversationHistory.length - earliest);

  for (let i = messageDomList.length - 1; i >= earliest; i--) {
    messageDomList[i].remove();
    messageDomList.pop();
  }

  isDeleteMode = false;
  document.getElementById('delete-mode-footer').style.display = 'none';
  removeAllSelections();
  selectedMessages = [];
});


document.getElementById('delete-cancel-btn').addEventListener('click', function() {
  isDeleteMode = false;
  document.getElementById('delete-mode-footer').style.display = 'none';
  removeAllSelections();
  selectedMessages = [];
});

function removeAllSelections() {
  messageDomList.forEach(msg => {
    const bubble = msg.querySelector('.message-bubble');
    if (bubble) bubble.classList.remove('selected');
  });
}


document.getElementById('user-avatar-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    userAvatar = evt.target.result;
  };
  reader.readAsDataURL(file);
});
document.getElementById('char-avatar-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    charAvatar = evt.target.result;
    document.getElementById('char-avatar-large').src = evt.target.result;
  };
  reader.readAsDataURL(file);
});


document.getElementById('background-image-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    const imageUrl = evt.target.result;
    document.getElementById('chat-background').style.backgroundImage = `url(${imageUrl})`;
  };
  reader.readAsDataURL(file);
});
document.getElementById('background-blur').addEventListener('input', function(e) {
  const blurValue = e.target.value;
  document.getElementById('chat-background').style.filter = `blur(${blurValue}px)`;
});
document.getElementById('remove-background-btn').addEventListener('click', function() {
  document.getElementById('chat-background').style.backgroundImage = 'none';
  document.getElementById('background-blur').value = 0;
  document.getElementById('chat-background').style.filter = 'blur(0px)';
});


function initParameterSliders() {
  const parameterIds = ['temperature', 'top-p', 'min-p', 'top-k', 'freq-penalty', 'rep-penalty'];
  parameterIds.forEach(id => {
    const slider = document.getElementById(id);
    const valueDisplay = document.getElementById(`${id}-value`);
    valueDisplay.textContent = slider.value;
    slider.addEventListener('input', function() {
      valueDisplay.textContent = this.value;
      switch(id) {
        case 'temperature': aiParams.temperature = parseFloat(this.value); break;
        case 'top-p':       aiParams.topP       = parseFloat(this.value); break;
        case 'min-p':       aiParams.minP       = parseFloat(this.value); break;
        case 'top-k':       aiParams.topK       = parseInt(this.value);   break;
        case 'freq-penalty':aiParams.frequencyPenalty = parseFloat(this.value); break;
        case 'rep-penalty': aiParams.repetitionPenalty = parseFloat(this.value); break;
      }
    });
  });

  document.getElementById('max-context').addEventListener('change', function() {
    aiParams.maxContext = parseInt(this.value);
  });
  document.getElementById('max-length').addEventListener('change', function() {
    aiParams.maxLength = parseInt(this.value);
  });
  document.getElementById('default-params-btn').addEventListener('click', resetToDefaultParams);
}
function resetToDefaultParams() {
  const defaults = {
    maxContext: 1000,
    maxLength: 500,
    temperature: 0.7,
    topP: 0.9,
    minP: 0.05,
    topK: 40,
    frequencyPenalty: 0,
    repetitionPenalty: 1.1
  };
  aiParams = { ...defaults };

  document.getElementById('max-context').value = defaults.maxContext;
  document.getElementById('max-length').value = defaults.maxLength;

  document.getElementById('temperature').value = defaults.temperature;
  document.getElementById('temperature-value').textContent = defaults.temperature;

  document.getElementById('top-p').value = defaults.topP;
  document.getElementById('top-p-value').textContent = defaults.topP;

  document.getElementById('min-p').value = defaults.minP;
  document.getElementById('min-p-value').textContent = defaults.minP;

  document.getElementById('top-k').value = defaults.topK;
  document.getElementById('top-k-value').textContent = defaults.topK;

  document.getElementById('freq-penalty').value = defaults.frequencyPenalty;
  document.getElementById('freq-penalty-value').textContent = defaults.frequencyPenalty;

  document.getElementById('rep-penalty').value = defaults.repetitionPenalty;
  document.getElementById('rep-penalty-value').textContent = defaults.repetitionPenalty;
}


function trimConversationHistory() {
  let totalLength = conversationHistory.reduce((acc, msg) => acc + msg.content.length, 0);
  while (totalLength > aiParams.maxContext && conversationHistory.length > 1) {
    totalLength -= conversationHistory[1].content.length;
    conversationHistory.splice(1, 1);
  }
}


async function callChatAPI(apiName) {
  trimConversationHistory();

  let headers = { "Content-Type": "application/json" };
  let payload = {};

  if (apiName === "openrouter") {
    headers["Authorization"] = `Bearer ${openrouterApiKeyGlobal}`;
    payload = {
      model: openrouterModelGlobal,
      messages: conversationHistory,
      temperature: aiParams.temperature,
      top_p: aiParams.topP,
      max_tokens: aiParams.maxLength,
      frequency_penalty: aiParams.frequencyPenalty,
      presence_penalty: aiParams.repetitionPenalty,
      top_k: aiParams.topK,
      min_p: aiParams.minP
    };

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("API Error:", data);
        throw new Error(`API request failed: ${response.status} - ${data.error?.message || response.statusText}`);
      }
      const botReply = data.choices && data.choices[0] && data.choices[0].message
                     ? data.choices[0].message.content
                     : "No response content.";
      return botReply;
    } catch (error) {
      console.error("API Call Error:", error);
      throw error;
    }

  } else {
    
    headers["Authorization"] = `Bearer ${mistralApiKeyGlobal}`;
    payload = {
      model: mistralModelGlobal || "mistral-large-latest",
      messages: conversationHistory,
      temperature: aiParams.temperature,
      top_p: aiParams.topP,
      max_tokens: aiParams.maxLength
    };

    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        console.error("API Error:", data);
        throw new Error(`API request failed: ${response.status} - ${data.error?.message || response.statusText}`);
      }

      const botReply = data.choices && data.choices[0] && data.choices[0].message
                     ? data.choices[0].message.content
                     : "No response content.";
      return botReply;
    } catch (error) {
      console.error("API Call Error:", error);
      throw error;
    }
  }
}


function appendMessage(content, className) {
  const container = document.createElement('div');
  container.classList.add('message-container');
  if (className.includes('user-message')) {
    container.classList.add('user');
  } else {
    container.classList.add('bot');
  }

 
  const avatar = document.createElement('img');
  avatar.classList.add('avatar');
  if (className.includes('user-message')) {
    avatar.src = userAvatar || 'https://via.placeholder.com/40?text=U';
  } else {
    avatar.src = charAvatar || 'https://via.placeholder.com/40?text=C';
  }

 
  const bubble = document.createElement('div');
  bubble.classList.add('message-bubble', className);
  bubble.textContent = content;

  
  if (className.includes('user-message')) {
    container.appendChild(bubble);
    container.appendChild(avatar);
  } else {
    container.appendChild(avatar);
    container.appendChild(bubble);
  }

  const chatWindow = document.getElementById('chat-window');
  chatWindow.appendChild(container);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  
  messageDomList.push(container);

  
  bubble.addEventListener('click', () => {
    if (!isDeleteMode) return;
    const idx = messageDomList.indexOf(container);
    if (idx < 0) return;
    if (bubble.classList.contains('selected')) {
      bubble.classList.remove('selected');
      selectedMessages = selectedMessages.filter(i => i !== idx);
    } else {
      bubble.classList.add('selected');
      selectedMessages.push(idx);
    }
  });

  return bubble;
}


function addRetryButton(messageBubble) {
  const retryBtn = document.createElement('button');
  retryBtn.textContent = "↻";
  retryBtn.classList.add('retry-button');
  retryBtn.addEventListener('click', async function() {
    const lastMsg = conversationHistory[conversationHistory.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") {
      alert("Only the latest character response can be retried.");
      return;
    }
    conversationHistory.pop();

  
    const bubbleContainer = messageBubble.parentElement;
    const idx = messageDomList.indexOf(bubbleContainer);
    if (idx >= 0) messageDomList.splice(idx, 1);
    bubbleContainer.remove();

    const selectedApi = document.getElementById('api-selector').value;
    try {
      const newBotReply = await callChatAPI(selectedApi);
      const newBubble = appendMessage(currentCharacterName + ": " + newBotReply, 'bot-message');
      conversationHistory.push({ role: "assistant", content: newBotReply });
      addRetryButton(newBubble);
    } catch (error) {
      console.error("Error during retry:", error);
      appendMessage("Error: " + error.message, 'bot-message');
    }
  });
  messageBubble.appendChild(retryBtn);
}


document.getElementById('send-btn').addEventListener('click', async function() {
  const messageInput = document.getElementById('message-input');
  const message = messageInput.value.trim();
  if (!message) return;

  appendMessage("You: " + message, 'user-message');
  conversationHistory.push({ role: "user", content: message });

  const selectedApi = document.getElementById('api-selector').value;
  try {
    const botReply = await callChatAPI(selectedApi);
    const bubble = appendMessage(currentCharacterName + ": " + botReply, 'bot-message');
    conversationHistory.push({ role: "assistant", content: botReply });
    addRetryButton(bubble);
  } catch (error) {
    console.error("Error:", error);
    appendMessage("Error: " + error.message, 'bot-message');
  }
  messageInput.value = "";
});

document.getElementById('message-input').addEventListener('keyup', function(e) {
  if (e.key === 'Enter') {
    document.getElementById('send-btn').click();
  }
});


document.getElementById('init-roleplay-btn').addEventListener('click', function() {
 
  const chatBgElement = document.getElementById('chat-background');
  const currentBgImage = chatBgElement.style.backgroundImage;
  const currentBgFilter = chatBgElement.style.filter;

 
  mistralApiKeyGlobal = document.getElementById('mistral-api-key').value.trim();
  mistralModelGlobal  = document.getElementById('mistral-model').value.trim();
  openrouterApiKeyGlobal = document.getElementById('openrouter-api-key').value.trim();
  openrouterModelGlobal  = document.getElementById('openrouter-model').value.trim();

  const userNameInput = document.getElementById('user-name');
  const userDescInput = document.getElementById('user-description');
  const charNameInput = document.getElementById('character-name');
  const charDescInput = document.getElementById('character-description');
  const initMsgInput = document.getElementById('initial-message');

  let userName = userNameInput.value.trim() || "Friend";
  let userDescription = userDescInput.value.trim() || "A mysterious individual.";
  let characterName = charNameInput.value.trim() || "Shadow";
  let characterDesc = charDescInput.value.trim() || "An enigmatic figure with a mysterious past.";
  let initialMessage = initMsgInput.value.trim() || "Hello.";

  currentCharacterName = characterName;
  document.getElementById('char-name-display').textContent = characterName;
  document.getElementById('char-desc-display').textContent = characterDesc;

  initialMessage = initialMessage
    .replace('{{user}}', userName)
    .replace('{{char}}', characterName)
    .replace('{{desc}}', characterDesc)
    .replace('{{userdesc}}', userDescription);

  const initialTemplate = `You are now roleplaying as "{{char}}". This is your persona: {{desc}}. You are interacting with a user named "{{user}}", who is described as: {{userdesc}}. Greet the user in a dark, gritty, and challenging scenario that might be unsettling or NSFW.`;
  const sustainedTemplate = `You are roleplaying as "{{char}}". Your persona is as follows: {{desc}}. Remain in character throughout this one-on-one conversation with the user "{{user}}", who is described as: {{userdesc}}. Do not reintroduce yourself or recreate the scenario—simply continue the dialogue in character.`;

  const systemPromptInitial = initialTemplate
    .replace('{{char}}', characterName)
    .replace('{{user}}', userName)
    .replace('{{desc}}', characterDesc)
    .replace('{{userdesc}}', userDescription);

  const systemPromptSustained = sustainedTemplate
    .replace('{{char}}', characterName)
    .replace('{{user}}', userName)
    .replace('{{desc}}', characterDesc)
    .replace('{{userdesc}}', userDescription);


  conversationHistory = [{ role: "system", content: systemPromptInitial }];
  messageDomList = [];
  selectedMessages = [];

  
  document.getElementById('chat-window').innerHTML = "<div id='chat-background'></div>";
  const newBgElement = document.getElementById('chat-background');
  newBgElement.style.backgroundImage = currentBgImage;
  newBgElement.style.filter = currentBgFilter;

 
  conversationHistory.push({ role: "assistant", content: initialMessage });
  const bubble = appendMessage(characterName + ": " + initialMessage, 'bot-message');
  addRetryButton(bubble);

 
  conversationHistory[0] = { role: "system", content: systemPromptSustained };

  
  document.getElementById('roleplay-init').style.display = "none";
});


document.addEventListener('DOMContentLoaded', function() {
  initParameterSliders();
});
