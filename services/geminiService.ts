import { GoogleGenAI, Type } from "@google/genai";
import type { InvoiceData } from '../types';

interface OcrLineItem {
  quantity: number;
  description: string;
  unitPrice: number;
  total: number;
}

// Type for raw data returned by Gemini
type GeminiInvoiceData = Omit<InvoiceData, 'items' | 'usePreloadedCatalog' | 'identifiedSupplierCuit'> & { items: OcrLineItem[] };


const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        resolve('');
      }
    };
    reader.readAsDataURL(file);
  });
  const base64EncodedData = await base64EncodedDataPromise;
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

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

export const extractInvoiceData = async (source: File | string): Promise<GeminiInvoiceData> => {
    // Práctica de Seguridad Recomendada:
    // La API Key se carga desde una variable de entorno (`process.env.API_KEY`).
    // Si bien esto evita que la clave esté en el control de versiones, sigue siendo accesible en el navegador.
    // Para un entorno de producción, esta llamada debe moverse a un backend proxy seguro
    // para garantizar que la API Key nunca se exponga en el lado del cliente.
    if (!process.env.API_KEY) {
        throw new Error("La variable de entorno API_KEY no está configurada.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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

    let contents;

    if (typeof source === 'string') {
        const textContent = `Aquí está el texto extraído de la factura:\n\n${source}`;
        contents = { parts: [{ text: textContent }, { text: basePrompt }] };
    } else {
        const imagePart = await fileToGenerativePart(source);
        contents = { parts: [imagePart, { text: basePrompt }] };
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: invoiceSchema,
            },
        });

        const jsonString = response.text;
        const parsedData = JSON.parse(jsonString) as GeminiInvoiceData;
        
        if (!parsedData || !parsedData.invoiceNumber || !Array.isArray(parsedData.items)) {
            throw new Error("La IA devolvió una estructura de datos inválida o incompleta.");
        }

        return parsedData;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("No se pudo procesar el documento con la IA. El documento puede no ser claro o el formato no es compatible.");
    }
};