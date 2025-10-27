/**
 * Plik: /api/ai.js
 * To jest Twój "backend" - funkcja serwerowa Vercel.
 * Jej zadaniem jest bezpieczne przechowanie klucza API i działanie jako pośrednik
 * między Twoim HTML a API Google.
 */

// Eksportujemy funkcję obsługującą żądania (Vercel to rozumie)
export default async function handler(request, response) {
  // 1. Odbierz dane (prompty) wysłane z pliku index.html
  // Sprawdzamy, czy żądanie jest typu POST
  if (request.method !== 'POST') {
    // Odpowiedź na inne metody niż POST
    response.setHeader('Allow', ['POST', 'OPTIONS']); // Informuj klienta o dozwolonych metodach
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // Obsługa żądania OPTIONS (ważne dla CORS preflight)
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', '*'); // Zezwól na żądania z dowolnego źródła
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Dozwolone metody
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Dozwolone nagłówki
    response.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight przez 24h
    return response.status(204).end(); // Odpowiedź 204 No Content dla OPTIONS
  }


  try {
    // Używamy "request.body" - Vercel automatycznie parsuje JSON
    const { userQuery, systemPrompt } = request.body;

    if (!userQuery || !systemPrompt) {
      return response.status(400).json({ error: 'Missing userQuery or systemPrompt in request body' });
    }

    // 2. Pobierz bezpiecznie klucz API ze Zmiennych Środowiskowych Vercel
    // Ta nazwa "GEMINI_API_KEY" musi być taka sama, jak ta ustawiona w panelu Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("Missing GEMINI_API_KEY environment variable");
      // Nie wysyłamy "Internal Server Error", żeby nie ujawniać problemu z kluczem
      return response.status(500).json({ error: 'Server configuration error' });
    }

    // 3. Przygotuj i wywołaj prawdziwe API Google (Gemini)
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

    // 4. Odeślij odpowiedź z powrotem do pliku index.html
    if (candidate && candidate.content?.parts?.[0]?.text) {
      const aiText = candidate.content.parts[0].text;
      
      // Ustawiamy nagłówki CORS dla odpowiedzi POST
      response.setHeader('Access-Control-Allow-Origin', '*'); // Zezwól na żądania z dowolnego źródła
      response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Odsyłamy tylko tekst, który jest potrzebny
      response.status(200).json({ text: aiText });
    } else {
      console.error("Invalid response structure from Google AI:", result);
      response.status(500).json({ error: 'Invalid response structure from Google AI' });
    }

  } catch (error) {
    console.error("Internal Server Error:", error);
    // Ustaw nagłówki CORS również dla odpowiedzi błędu
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

