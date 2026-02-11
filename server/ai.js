import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BLACKBOX_API_KEY = process.env.BLACKBOX_API_KEY || "sk-wqiWWPruUyMYINsv6tQCGQ";
const BLACKBOX_API_URL = "https://api.blackbox.ai/chat/completions";

export const getAISuggestions = async (currentSong) => {
  const prompt = `The song "${currentSong.title}" by ${currentSong.artist} was just interrupted/rejected by the community. 
Suggest 4 similar or complementary songs that would be great to play next on an uncensored, high-fidelity DNA radio station with a cyberpunk aesthetic.
Return ONLY a valid JSON array of objects, each with "title" and "artist" fields. 
Example: [{"title": "Song A", "artist": "Artist A"}, ...]`;

  try {
    const response = await axios.post(BLACKBOX_API_URL, {
      model: "blackboxai/anthropic/claude-sonnet-4.5",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500
    }, {
      headers: {
        "Authorization": `Bearer ${BLACKBOX_API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const content = response.data.choices[0].message.content;
    // Extract JSON from potential markdown blocks
    const jsonMatch = content.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (error) {
    console.error('[AI] Failed to get suggestions:', error.message);
    // Fallback suggestions
    return [
      { title: "Resonance", artist: "Home" },
      { title: "Nightcall", artist: "Kavinsky" },
      { title: "Turbo Killer", artist: "Carpenter Brut" },
      { title: "After Dark", artist: "Mr.Kitty" }
    ];
  }
};
