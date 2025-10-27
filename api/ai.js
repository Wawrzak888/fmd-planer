/**
 * Plik: /api/ai.js
 * Wersja 2 - z pełną obsługą CORS (OPTIONS)
 * To jest Twój "backend" - funkcja serwerowa Vercel.
 */

// Eksportujemy funkcję obsługującą żądania (Vercel to rozumie)
export default async function handler(request, response) {
  // --- POCZĄTEK POPRAWKI CORS ---
  // Ustaw nagłówki, które będą wspólne dla wszystkich odpowiedzi
  response.setHeader('Access-Control-Allow-Origin', '*'); // Zezwól na żądania z dowolnego źródła
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Dozwolone metody
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Dozwolone nagłówki

  // 1. Obsługa "zapytania sprawdzającego" (preflight) wysyłanego przez przeglądarkę
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Max-Age', '86400'); // Cache'uj te ustawienia przez 24h
    return response.status(204).end(); // Odpowiedz 204 No Content (i zakończ)
  }
  // --- KONIEC POPRAWKI CORS ---

  // 2. Obsługa właściwego żądania POST
  if (request.method === 'POST') {
    try {
      const { userQuery, systemPrompt } = request.body;

      if (!userQuery || !systemPrompt) {
        return response.status(400).json({ error: 'Missing userQuery or systemPrompt in request body' });
      }

      // 3. Pobierz bezpiecznie klucz API
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error("Missing GEMINI_API_KEY environment variable");
        return response.status(500).json({ error: 'Server configuration error' });
      }

      // 4. Wywołaj API Google
      const googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
      };

      const apiResponse = await fetch(googleApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("Google API Error:", errorText);
        return response.status(apiResponse.status).json({ error: 'Failed to fetch from Google AI', details: errorText });
      }

      const result = await apiResponse.json();
      const candidate = result.candidates?.[0];

      // 5. Odeślij odpowiedź do pliku index.html
      if (candidate && candidate.content?.parts?.[0]?.text) {
        const aiText = candidate.content.parts[0].text;
        return response.status(200).json({ text: aiText });
      } else {
        console.error("Invalid response structure from Google AI:", result);
        return response.status(500).json({ error: 'Invalid response structure from Google AI' });
      }

    } catch (error) {
      console.error("Internal Server Error:", error);
      return response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
  }

  // 6. Jeśli to nie był ani OPTIONS, ani POST
  response.setHeader('Allow', ['POST', 'OPTIONS']);
  return response.status(405).json({ error: `Method ${request.method} Not Allowed` });
}

