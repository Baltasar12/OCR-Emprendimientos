import { kv } from '@vercel/kv';
import { GoogleGenAI, Type } from "@google/genai";

// Required for Vercel Edge Functions
export const config = {
  runtime: 'edge',
};

// This schema must be kept in sync with the frontend's expectations and the prompt.
const invoiceSchema = {
    type: Type.OBJECT,
    properties: {
        invoiceNumber: { type: Type.STRING, description: "Número de Factura o Comprobante, ej: 0004-00123456" },
        invoiceDate: { type: Type.STRING, description: "Fecha de la factura en formato YYYY-MM-DD" },
        supplierName: { type: Type.STRING, description: "Nombre o Razón Social del emisor de la factura" },
        cuit: { type: Type.STRING, description: "C.U.I.T. del emisor, ej: 30-12345678-9" },
        totalAmount: { type: Type.NUMBER, description: "El importe total final de la factura" },
        ivaPerception: { type: Type.NUMBER, description: "Percepción de IVA si existe, sino null" },
        grossIncomePerception: { type: Type.NUMBER, description: "Percepción de Ingresos Brutos si existe, sino null" },
        otherTaxes: { type: Type.NUMBER, description: "Otros impuestos si existen, sino null" },
        items: {
            type: Type.ARRAY,
            description: "Lista de items o productos en la factura",
            items: {
                type: Type.OBJECT,
                properties: {
                    quantity: { type: Type.NUMBER, description: "Cantidad del item" },
                    description: { type: Type.STRING, description: "Descripción del producto o servicio" },
                    unitPrice: { type: Type.NUMBER, description: "Precio por unidad del item" },
                    total: { type: Type.NUMBER, description: "Importe total para este item (cantidad * precio unitario)" },
                },
                required: ["quantity", "description", "unitPrice", "total"]
            }
        }
    },
    required: ["invoiceNumber", "invoiceDate", "cuit", "supplierName", "totalAmount", "items"]
};

const basePrompt = `
    Analiza los datos de esta factura o remito. Extrae la siguiente información y devuélvela estrictamente en formato JSON según el schema proporcionado.
    - Número de Factura/Comprobante
    - Fecha de la Factura (formato YYYY-MM-DD)
    - Nombre o Razón Social del emisor
    - CUIT del emisor
    - Importe Total
    - Percepciones de IVA e Ingresos Brutos (si están presentes)
    - Lista detallada de todos los ítems, con su cantidad, descripción, precio unitario e importe total.
    Si un campo opcional como una percepción no se encuentra, su valor debe ser null.
`;


export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY; 
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API Key no configurada en el servidor' }), { status: 500 });
  }

  let jobId: string;
  try {
    const { jobId: receivedJobId, fileData, mimeType } = await request.json();
    jobId = receivedJobId; // Assign to outer scope for error handling

    if (!jobId || !fileData || !mimeType) {
      return new Response(JSON.stringify({ error: 'jobId, fileData, and mimeType are required.' }), { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const imagePart = {
      inlineData: {
        data: fileData,
        mimeType: mimeType,
      },
    };

    const contents = { parts: [imagePart, { text: basePrompt }] };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: invoiceSchema,
      },
    });

    let jsonString = response.text;
    if (jsonString.startsWith("```json")) {
        jsonString = jsonString.replace("```json", "").replace("```", "").trim();
    }
    
    const parsedData = JSON.parse(jsonString);

    // Save successful result to KV, expiring in 1 hour
    await kv.set(jobId, { status: 'complete', data: parsedData, jobId }, { ex: 3600 });

    return new Response(JSON.stringify({ success: true, jobId }), { status: 200 });

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor al procesar con la IA';
    
    // If we have a jobId, update the status to 'failed'
    if (jobId) {
      await kv.set(jobId, { status: 'failed', error: errorMessage, jobId }, { ex: 3600 });
    }

    // Still return a 200 OK because the *worker* function itself completed,
    // even if the job failed. The failure state is recorded in KV.
    // A 500 would imply the worker itself crashed.
    return new Response(JSON.stringify({ success: false, error: errorMessage }), { status: 200 });
  }
}
