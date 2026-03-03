const { GoogleGenAI } = require('@google/genai');

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const BASE_TEDDY_PROMPT = `You are Teddy, a friendly English tutor for children aged 6-10.
Speak slowly and clearly, always use simple vocabulary.
When the child makes a grammar mistake, correct it gently by naturally repeating 
the correct form in your response — never say "wrong", "mistake", or "incorrect".
Keep the conversation fun, playful and always encouraging.
Ask one simple follow-up question at the end of each response to keep the child engaged.
Keep responses short: 2-3 sentences maximum.
Remember what the child told you in previous messages and reference it naturally.`;

const TOPIC_PROMPTS = {
  'daily-life': `${BASE_TEDDY_PROMPT}
Today we're practicing about Daily Life. Help the child talk about their everyday activities, daily routines, family, meals, school, and things they do regularly.
Guide the conversation to explore morning routines, meals, bedtime, homework, playing, etc.`,

  'adventure': `${BASE_TEDDY_PROMPT}
Today we're practicing about Adventure. Help the child talk about exciting places, journeys, traveling, and fun experiences.
Encourage them to describe trips, new places they've been or want to go, activities they enjoy, and adventures they'd like to have.`,

  'hobbies': `${BASE_TEDDY_PROMPT}
Today we're practicing about Hobbies. Help the child talk about things they enjoy doing, sports, games, crafts, reading, music, and entertainment.
Ask about their favorite activities, what they like to do for fun, and encourage them to describe their hobbies in detail.`,
};

/**
 * Send a message to Gemini and get Teddy's reply
 * @param {string} message - The user's message
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history - Conversation history
 * @param {string} topic - The selected topic: daily-life, adventure, hobbies
 * @param {boolean} isFirstMessage - Whether this is the first message to start the session
 * @returns {Promise<string>} - Teddy's reply
 */
async function getTeddyReply(message, history = [], topic = 'daily-life', isFirstMessage = false) {
  try {
    // Special handling for first message: send natural greeting + topic inquiry
    if (isFirstMessage || message === '[START_SESSION]') {
      const systemPromptText = `${BASE_TEDDY_PROMPT}
This is the beginning of our conversation. Greet the child warmly and ask them what topic they'd like to talk about.
You can mention these options: talking about their daily life (school, family, activities), adventures and travels, or their hobbies and things they enjoy.
Make it fun and inviting!`;

      const response = await client.models.generateContent({
        model: 'models/gemini-flash-latest',
        contents: [{
          role: 'user',
          parts: [{ text: 'Hello Teddy!' }],
        }],
        systemInstruction: {
          parts: [{ text: systemPromptText }],
        },
      });

      let reply = null;
      if (response && Array.isArray(response.candidates) && response.candidates.length > 0) {
        const parts = response.candidates[0].content && response.candidates[0].content.parts;
        if (Array.isArray(parts)) {
          reply = parts.map(p => p.text || '').join('');
        }
      }
      if (!reply) reply = "Oh! I had a little trouble understanding. Could you say that again, please?";
      return reply;
    }

    // Regular conversation flow: use topic-specific prompt
    const systemPromptText = TOPIC_PROMPTS[topic] || TOPIC_PROMPTS['daily-life'];

    // Build the full message history for the API
    // Add the new user message to the history
    const contents = [
      ...history,
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const response = await client.models.generateContent({
      model: 'models/gemini-flash-latest',
      contents,
      systemInstruction: {
        parts: [{ text: systemPromptText }],
      },
    });

    // Extract reply text from the SDK response shape
    let reply = null;
    if (response && Array.isArray(response.candidates) && response.candidates.length > 0) {
      const parts = response.candidates[0].content && response.candidates[0].content.parts;
      if (Array.isArray(parts)) {
        reply = parts.map(p => p.text || '').join('');
      }
    }
    // Fallback if structure unexpected
    if (!reply) reply = "Oh! I had a little trouble understanding. Could you say that again, please?";
    return reply;
  } catch (error) {
    console.error('Gemini API error:', error);
    // Return a friendly fallback message
    return "Oh! I had a little trouble understanding. Could you say that again, please?";
  }
}

module.exports = { getTeddyReply };
