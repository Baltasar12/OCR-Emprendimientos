// services/geminiService.ts
import type { InvoiceData } from '../types';

type GeminiInvoiceData = Omit<InvoiceData, 'items' | 'usePreloadedCatalog' | 'identifiedSupplierCuit'> & { items: { quantity: number; description: string; unitPrice: number; total: number; }[] };

export const extractInvoiceData = async (source: File | string): Promise<GeminiInvoiceData> => {
  const basePrompt = `
    Analiza los datos de esta factura. Extrae y devuelve estrictamente en formato JSON la siguiente información: 
    invoiceNumber (string), invoiceDate (string YYYY-MM-DD), supplierName (string), cuit (string), 
    totalAmount (number), y un array 'items' con objetos que contengan quantity (number), 
    description (string), unitPrice (number), y total (number).
  `;

  const formData = new FormData();
  if (typeof source !== 'string') {
    formData.append('file', source);
  }
  formData.append('prompt', basePrompt);

  try {
    // ¡Ahora llamamos a nuestro propio backend!
    const response = await fetch('/api/procesar-factura', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Respuesta no exitosa del servidor');
    }

    return await response.json() as GeminiInvoiceData;

  } catch (error) {
    console.error("Error al llamar al backend proxy:", error);
    throw new Error("No se pudo comunicar con el servidor para procesar el documento.");
  }
};