// api/procesar-factura.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  // La clave ahora se lee desde el entorno del servidor, es 100% seguro.
  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key no configurada en el servidor' }), { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const prompt = formData.get('prompt') as string;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No se recibió ningún archivo' }), { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const imagePart = {
      inlineData: {
        data: Buffer.from(await file.arrayBuffer()).toString("base64"),
        mimeType: file.type,
      },
    };

  const result = await model.generateContent([prompt, imagePart]);
    
    // --- INICIO DE LA CORRECCIÓN ---
    let jsonResponse = result.response.text();

    // Limpiamos el posible formato Markdown que a veces añade la IA
    if (jsonResponse.startsWith("```json")) {
      jsonResponse = jsonResponse.replace("```json", "").replace("```", "").trim();
    }
    // --- FIN DE LA CORRECCIÓN ---

    return new Response(jsonResponse, { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en la función serverless:', error);
    return new Response(JSON.stringify({ error: 'Error interno del servidor al procesar con la IA' }), { status: 500 });
  }
}