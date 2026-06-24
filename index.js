const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = 'You are an energetic and persuasive enrollment assistant for WinStar Education, a leading education consultancy in Bangladesh. People are messaging your Facebook Page after seeing an ad. Your job is to qualify them and get their contact details FAST.\n\nWINSTAR SERVICES:\n- Study Abroad: UK, Canada, Australia, USA, Malaysia, Europe\n- IELTS Preparation: Batch classes and one-to-one coaching\n- PTE Preparation: Batch classes and one-to-one coaching\n- Free Consultation available\n\nLANGUAGE: Reply in Bengali if they write Bengali, English if they write English.\n\nGOAL: Get their Name, Phone Number and interest within 1-2 messages. Then confirm the team will call them soon.\n\nTONE: Confident, warm, action-oriented. Max 3 sentences per reply. Use emojis naturally.\n\nWhatsApp: +8801329665444';

const conversations = {};

app.get('/webhook', function(req, res) {
  var mode = req.query['hub.mode'];
  var token = req.query['hub.verify_token'];
  var challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async function(req, res) {
  var body = req.body;
  if (body.object === 'page') {
    for (var i = 0; i < body.entry.length; i++) {
      var event = body.entry[i].messaging[0];
      var senderId = event.sender.id;
      if (event.message && event.message.text) {
        var userMessage = event.message.text;
        try {
          var reply = await getClaudeReply(senderId, userMessage);
          await sendMessage(senderId, reply);
        } catch (err) {
          console.error('Error:', err.message);
          await sendMessage(senderId, 'Sorry, something went wrong. Please WhatsApp us at +8801329665444');
        }
      }
    }
    res.status(200).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(404);
  }
});

async function getClaudeReply(senderId, userMessage) {
  if (!conversations[senderId]) {
    conversations[senderId] = [];
  }
  conversations[senderId].push({ role: 'user', content: userMessage });
  if (conversations[senderId].length > 10) {
    conversations[senderId] = conversations[senderId].slice(-10);
  }
  var response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: conversations[senderId]
  }, {
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });
  var reply = response.data.content[0].text;
  conversations[senderId].push({ role: 'assistant', content: reply });
  return reply;
}

async function sendMessage(recipientId, text) {
  await axios.post('https://graph.facebook.com/v19.0/me/messages?access_token=' + PAGE_ACCESS_TOKEN, {
    recipient: { id: recipientId },
    message: { text: text }
  });
}

app.get('/', function(req, res) {
  res.send('WinStar Bot is running!');
});

var PORT = process.env.PORT || 3000;
app.listen(PORT, function() {
  console.log('Server running on port ' + PORT);
});
